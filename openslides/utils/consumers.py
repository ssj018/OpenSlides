from collections import defaultdict
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs

import jsonschema
from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from ..core.config import config
from ..core.models import Projector
from .auth import async_anonymous_is_enabled, has_perm
from .cache import element_cache, split_element_id
from .collection import (
    AutoupdateFormat,
    Collection,
    CollectionElement,
    format_for_autoupdate_old,
    from_channel_message,
)
from .constants import get_constants


class ProtocollAsyncJsonWebsocketConsumer(AsyncJsonWebsocketConsumer):
    """
    Mixin for JSONWebsocketConsumers, that speaks the a special protocol.
    """
    schema = {
        "$schema": "http://json-schema.org/draft-04/schema#",
        "title": "OpenSlidesWebsocketProtocol",
        "description": "The base packages that OpenSlides sends between the server and the client.",
        "type": "object",
        "properties": {
            "type": {
                "description": "Defines what kind of packages is packed.",
                "type": "string",
                "pattern": "notify|constants|getElements|autoupdate",  # The server can sent other types
            },
            "content": {
                "description": "The content of the package.",
            },
            "id": {
                "description": "An identifier of the package.",
                "type": "string",
            },
            "in_response": {
                "description": "The id of another package that the other part sent before.",
                "type": "string",
            }
        },
        "required": ["type", "content", "id"],
    }

    async def send_json(self, type: str, content: Any, id: Optional[str] = None, in_response: Optional[str] = None) -> None:
        """
        Sends the data with the type.
        """
        out = {'type': type, 'content': content}
        if id:
            out['id'] = id
        if in_response:
            out['in_response'] = in_response
        await super().send_json(out)

    async def receive_json(self, content: Any) -> None:
        """
        Receives the json data, parses it and calls receive_content.
        """
        try:
            jsonschema.validate(content, self.schema)
        except jsonschema.ValidationError as err:
            try:
                in_response = content['id']
            except (TypeError, KeyError):
                # content is not a dict (TypeError) or has not the key id (KeyError)
                in_response = None

            await self.send_json(
                type='error',
                content=str(err),
                in_response=in_response)
            return

        await self.receive_content(type=content['type'], content=content['content'], id=content['id'])

    async def receive_content(self, type: str, content: object, id: str) -> None:
        raise NotImplementedError("ProtocollAsyncJsonWebsocketConsumer needs the method receive_content()")


class SiteConsumer(ProtocollAsyncJsonWebsocketConsumer):
    """
    Websocket Consumer for the site.
    """

    groups = ['site']

    async def connect(self) -> None:
        """
        A user connects to the site.

        If it is an anonymous user and anonymous is disabled, the connection is closed.

        Sends the startup data to the user.
        """
        change_id = None
        if not await async_anonymous_is_enabled() and self.scope['user'].id is None:
            await self.close()
            return

        query_string = parse_qs(self.scope['query_string'])
        if b'change_id' in query_string:
            try:
                change_id = int(query_string[b'change_id'][0])
            except ValueError:
                await self.close()  # TODO: Find a way to send an error code
                return

        if b'autoupdate' in query_string and query_string[b'autoupdate'][0].lower() not in [b'0', b'off', b'false']:
            # a positive value in autoupdate. Start autoupdate
            await self.channel_layer.group_add('autoupdate', self.channel_name)

        await self.accept()
        if change_id is not None:
            data = await get_element_data(self.scope['user'], change_id)
            await self.send_json(type='autoupdate', content=data)

    async def disconnect(self, close_code: int) -> None:
        """
        A user disconnects. Remove it from autoupdate.
        """
        await self.channel_layer.group_discard('autoupdate', self.channel_name)

    async def receive_content(self, type: str, content: Any, id: str) -> None:
        """
        If we recieve something from the client we currently just interpret this
        as a notify message.

        The server adds the sender's user id (0 for anonymous) and reply
        channel name so that a receiver client may reply to the sender or to all
        sender's instances.
        """
        if type == 'notify':
            if notify_message_is_valid(content):
                await self.channel_layer.group_send(
                    "projector",
                    {
                        "type": "send_notify",
                        "incomming": content,
                        "senderReplyChannelName": self.channel_name,
                        "senderUserId": self.scope['user'].id or 0,
                    },
                )
                await self.channel_layer.group_send(
                    "site",
                    {
                        "type": "send_notify",
                        "incomming": content,
                        "senderReplyChannelName": self.channel_name,
                        "senderUserId": self.scope['user'].id or 0,
                    },
                )
            else:
                await self.send_json(type='error', content='Invalid notify message', in_response=id)

        elif type == 'constants':
            # Return all constants to the client.
            await self.send_json(type='constants', content=get_constants(), in_response=id)

        elif type == 'getElements':
            # Return all Elements since a change id
            if elements_message_is_valid(content):
                requested_change_id = content.get('change_id', 0)
                try:
                    element_data = await get_element_data(self.scope['user'], requested_change_id)
                except ValueError as error:
                    await self.send_json(type='error', content=str(error), in_response=id)
                else:
                    await self.send_json(type='autoupdate', content=element_data, in_response=id)
            else:
                await self.send_json(type='error', content='Invalid getElements message', in_response=id)

        elif type == 'autoupdate':
            # Turn on or off the autoupdate for the client
            if content:  # accept any value, that can be interpreted as bool
                await self.channel_layer.group_add('autoupdate', self.channel_name)
            else:
                await self.channel_layer.group_discard('autoupdate', self.channel_name)

    async def send_notify(self, event: Dict[str, Any]) -> None:
        """
        Send a notify message to the user.
        """
        user_id = self.scope['user'].id or 0

        out = []
        for item in event['incomming']:
            users = item.get('users')
            reply_channels = item.get('replyChannels')
            projectors = item.get('projectors')
            if ((isinstance(users, list) and user_id in users)
                    or (isinstance(reply_channels, list) and self.channel_name in reply_channels)
                    or (users is None and reply_channels is None and projectors is None)):
                item['senderReplyChannelName'] = event.get('senderReplyChannelName')
                item['senderUserId'] = event.get('senderUserId')
                item['senderProjectorId'] = event.get('senderProjectorId')
                out.append(item)

        if out:
            await self.send_json(type='notify', content=out)

    async def send_data(self, event: Dict[str, Any]) -> None:
        """
        Send changed or deleted elements to the user.
        """
        change_id = event['change_id']
        changed_elements, deleted_elements_ids = await element_cache.get_restricted_data(self.scope['user'], change_id, max_change_id=change_id)

        deleted_elements: Dict[str, List[int]] = defaultdict(list)
        for element_id in deleted_elements_ids:
            collection_string, id = split_element_id(element_id)
            deleted_elements[collection_string].append(id)
        await self.send_json(type='autoupdate', content=AutoupdateFormat(
            changed=changed_elements,
            deleted=deleted_elements,
            from_change_id=change_id,
            to_change_id=change_id,
            all_data=False))


class ProjectorConsumer(ProtocollAsyncJsonWebsocketConsumer):
    """
    Websocket Consumer for the projector.
    """

    groups = ['projector']

    async def connect(self) -> None:
        """
        Adds the websocket connection to a group specific to the projector with the given id.
        Also sends all data that are shown on the projector.
        """
        user = self.scope['user']
        projector_id = self.scope["url_route"]["kwargs"]["projector_id"]
        await self.accept()

        if not await database_sync_to_async(has_perm)(user, 'core.can_see_projector'):
            await self.send_json(type='error', content='No permissions to see this projector.')
            # TODO: Shouldend we just close the websocket connection with an error message?
            #       self.close(code=4403)
        else:
            out = await sync_to_async(projector_startup_data)(projector_id)
            await self.send_json(type='autoupdate', content=out)

    async def receive_content(self, type: str, content: Any, id: str) -> None:
        """
        If we recieve something from the client we currently just interpret this
        as a notify message.

        The server adds the sender's user id (0 for anonymous) and reply
        channel name so that a receiver client may reply to the sender or to all
        sender's instances.
        """
        projector_id = self.scope["url_route"]["kwargs"]["projector_id"]
        await self.channel_layer.group_send(
            "projector",
            {
                "type": "send_notify",
                "incomming": content,
                "senderReplyChannelName": self.channel_name,
                "senderProjectorId": projector_id,
            },
        )
        await self.channel_layer.group_send(
            "site",
            {
                "type": "send_notify",
                "incomming": content,
                "senderReplyChannelName": self.channel_name,
                "senderProjectorId": projector_id,
            },
        )

    async def send_notify(self, event: Dict[str, Any]) -> None:
        """
        Send a notify message to the projector.
        """
        projector_id = self.scope["url_route"]["kwargs"]["projector_id"]

        out = []
        for item in event['incomming']:
            users = item.get('users')
            reply_channels = item.get('replyChannels')
            projectors = item.get('projectors')
            if ((isinstance(projectors, list) and projector_id in projectors)
                    or (isinstance(reply_channels, list) and self.channel_name in reply_channels)
                    or (users is None and reply_channels is None and projectors is None)):
                item['senderReplyChannelName'] = event.get('senderReplyChannelName')
                item['senderUserId'] = event.get('senderUserId')
                item['senderProjectorId'] = event.get('senderProjectorId')
                out.append(item)

        if out:
            await self.send_json(type='notify', content=out)

    async def send_data(self, event: Dict[str, Any]) -> None:
        """
        Informs all projector clients about changed data.
        """
        projector_id = self.scope["url_route"]["kwargs"]["projector_id"]
        collection_elements = from_channel_message(event['message'])

        output = await projector_sync_send_data(projector_id, collection_elements)
        if output:
            await self.send_json(type='autoupdate', content=output)


async def get_element_data(user: Optional[CollectionElement], change_id: int = 0) -> AutoupdateFormat:
    """
    Returns all data for startup.
    """
    current_change_id = await element_cache.get_current_change_id()
    if change_id > current_change_id:
        raise ValueError("Requested change_id is higher this highest change_id.")
    try:
        changed_elements, deleted_element_ids = await element_cache.get_restricted_data(user, change_id, current_change_id)
    except RuntimeError:
        # The change_id is lower the the lowerst change_id in redis. Return all data
        changed_elements = await element_cache.get_all_restricted_data(user)
        all_data = True
        deleted_elements: Dict[str, List[int]] = {}
    else:
        all_data = False
        deleted_elements = defaultdict(list)
        for element_id in deleted_element_ids:
            collection_string, id = split_element_id(element_id)
            deleted_elements[collection_string].append(id)

    return AutoupdateFormat(
        changed=changed_elements,
        deleted=deleted_elements,
        from_change_id=change_id,
        to_change_id=current_change_id,
        all_data=all_data)


def projector_startup_data(projector_id: int) -> Any:
    """
    Generate the startup data for a projector.
    """
    try:
        projector = Projector.objects.get(pk=projector_id)
    except Projector.DoesNotExist:
        return {'text': 'The projector {} does not exist.'.format(projector_id)}
    else:
        # Now check whether broadcast is active at the moment. If yes,
        # change the local projector variable.
        if config['projector_broadcast'] > 0:
            projector = Projector.objects.get(pk=config['projector_broadcast'])

        # Collect all elements that are on the projector.
        output = []
        for requirement in projector.get_all_requirements():
            required_collection_element = CollectionElement.from_instance(requirement)
            output.append(required_collection_element.as_autoupdate_for_projector())

        # Collect all config elements.
        config_collection = Collection(config.get_collection_string())
        projector_data = (config_collection.get_access_permissions()
                          .get_projector_data(config_collection.get_full_data()))
        for data in projector_data:
            output.append(format_for_autoupdate_old(
                config_collection.collection_string,
                data['id'],
                'changed',
                data))

        # Collect the projector instance.
        collection_element = CollectionElement.from_instance(projector)
        output.append(collection_element.as_autoupdate_for_projector())

        # Send all the data that were only collected before.
        return output


@sync_to_async
def projector_sync_send_data(projector_id: int, collection_elements: List[CollectionElement]) -> List[Any]:
    """
    sync function that generates the elements for an projector.
    """
    # Load the projector object. If broadcast is on, use the broadcast projector
    # instead.
    if config['projector_broadcast'] > 0:
        projector_id = config['projector_broadcast']

    projector = Projector.objects.get(pk=projector_id)

    # TODO: This runs once for every open projector tab. Either use
    #       caching or something else, so this is only called once
    output = []
    for collection_element in collection_elements:
        if collection_element.is_deleted():
            output.append(collection_element.as_autoupdate_for_projector())
        else:
            for element in projector.get_collection_elements_required_for_this(collection_element):
                output.append(element.as_autoupdate_for_projector())
    return output


def notify_message_is_valid(message: object) -> bool:
    """
    Returns True, when the message is a valid notify_message.
    """
    schema = {
        "$schema": "http://json-schema.org/draft-04/schema#",
        "title": "Notify elements.",
        "description": "Elements that one client can send to one or many other clients.",
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "projectors": {
                    "type": "array",
                    "items": {"type": "integer"},
                },
                "reply_channels": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "users": {
                    "type": "array",
                    "items": {"type": "integer"},
                }
            }
        },
        "minItems": 1,
    }
    try:
        jsonschema.validate(message, schema)
    except jsonschema.ValidationError:
        return False
    else:
        return True


def elements_message_is_valid(message: object) -> bool:
    """
    Return True, if the message is a valid getElement message.
    """
    schema = {
        "$schema": "http://json-schema.org/draft-04/schema#",
        "titel": "getElement request",
        "description": "Request from the client to server to get elements.",
        "type": "object",
        "properties": {
            # propertie is not required
            "change_id": {
                "type": "integer",
            }
        },
    }
    try:
        jsonschema.validate(message, schema)
    except jsonschema.ValidationError:
        return False
    else:
        return True
