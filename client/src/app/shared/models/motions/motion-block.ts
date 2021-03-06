import { AgendaBaseModel } from '../base/agenda-base-model';

/**
 * Representation of a motion block.
 * @ignore
 */
export class MotionBlock extends AgendaBaseModel {
    public id: number;
    public title: string;
    public agenda_item_id: number;

    public constructor(input?: any) {
        super('motions/motion-block', 'Motion block', input);
    }

    public getTitle(): string {
        return this.title;
    }

    public getDetailStateURL(): string {
        return 'TODO';
    }
}
