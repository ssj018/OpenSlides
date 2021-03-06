describe('linenumbering', function () {

  beforeEach(module('OpenSlidesApp.motions.lineNumbering'));

  var lineNumberingService,
      brMarkup = function (no) {
        return '<br class="os-line-break">' +
            '<span class="os-line-number line-number-' + no + '" data-line-number="' + no + '" contenteditable="false">&nbsp;</span>';
      },
      noMarkup = function (no) {
        return '<span class="os-line-number line-number-' + no + '" data-line-number="' + no + '" contenteditable="false">&nbsp;</span>';
      },
      longstr = function (length) {
        var outstr = '';
        for (var i = 0; i < length; i++) {
          outstr += String.fromCharCode(65 + (i % 26));
        }
        return outstr;
      };

  beforeEach(inject(function (_lineNumberingService_) {
    lineNumberingService = _lineNumberingService_;
  }));

  describe('paragraph splitting', function () {
      it('breaks simple DIVs', function () {
          var htmlIn = '<DIV class="testclass">Test <strong>1</strong></DIV>' + "\n" + '<p>Test <em>2</em> 3</p>';
          var out = lineNumberingService.splitToParagraphs(htmlIn);
          expect(out.length).toBe(2);
          expect(out[0]).toBe('<div class="testclass">Test <strong>1</strong></div>');
          expect(out[1]).toBe('<p>Test <em>2</em> 3</p>');
      });
      it('ignores root-level text-nodes', function () {
          var htmlIn = '<DIV class="testclass">Test <strong>3</strong></DIV>' + "\n New line";
          var out = lineNumberingService.splitToParagraphs(htmlIn);
          expect(out.length).toBe(1);
          expect(out[0]).toBe('<div class="testclass">Test <strong>3</strong></div>');
      });
      it('splits UL-Lists', function () {
          var htmlIn = "<UL class='testclass'>\n<li>Node 1</li>\n  <li class='second'>Node <strong>2</strong></li><li><p>Node 3</p></li></UL>";
          var out = lineNumberingService.splitToParagraphs(htmlIn);
          expect(out.length).toBe(3);
          expect(out[0]).toBe('<ul class="testclass"><li>Node 1</li></ul>');
          expect(out[1]).toBe('<ul class="testclass"><li class="second">Node <strong>2</strong></li></ul>');
          expect(out[2]).toBe('<ul class="testclass"><li><p>Node 3</p></li></ul>');
      });
      it('splits OL-Lists', function () {
          var htmlIn = "<OL start='2' class='testclass'>\n<li>Node 1</li>\n  <li class='second'>Node <strong>2</strong></li><li><p>Node 3</p></li></OL>";
          var out = lineNumberingService.splitToParagraphs(htmlIn);
          expect(out.length).toBe(3);
          expect(out[0]).toBe('<ol start="2" class="testclass"><li>Node 1</li></ol>');
          expect(out[1]).toBe('<ol start="3" class="testclass"><li class="second">Node <strong>2</strong></li></ol>');
          expect(out[2]).toBe('<ol start="4" class="testclass"><li><p>Node 3</p></li></ol>');
      });
  });

  describe('getting line number range', function () {
      it('extracts the line number range, example 1', function () {
        var html = '<p>' + noMarkup(2) + 'et accusam et justo duo dolores et ea <span style="color: #ff0000;"><strike>rebum </strike></span><span style="color: #006400;">Inserted Text</span>. Stet clita kasd ' + brMarkup(3) + 'gubergren,</p>';
        var range = lineNumberingService.getLineNumberRange(html);
        expect(range).toEqual({"from": 2, "to": 4});
      });
  });

  describe('line numbering: test nodes', function () {
    it('breaks very short lines', function () {
      var textNode = document.createTextNode("0123");
      lineNumberingService._currentInlineOffset = 0;
      lineNumberingService._currentLineNumber = 1;
      var out = lineNumberingService._textNodeToLines(textNode, 5);
      var outHtml = lineNumberingService._nodesToHtml(out);
      expect(outHtml).toBe('0123');
      expect(lineNumberingService._currentInlineOffset).toBe(4);
    });

    it('breaks simple lines', function () {
      var textNode = document.createTextNode("012345678901234567");
      lineNumberingService._currentInlineOffset = 0;
      lineNumberingService._currentLineNumber = 1;
      var out = lineNumberingService._textNodeToLines(textNode, 5);
      var outHtml = lineNumberingService._nodesToHtml(out);
      expect(outHtml).toBe('01234' + brMarkup(1) + '56789' + brMarkup(2) + '01234' + brMarkup(3) + '567');
      expect(lineNumberingService._currentInlineOffset).toBe(3);
    });

    it('breaks simple lines with offset', function () {
      var textNode = document.createTextNode("012345678901234567");
      lineNumberingService._currentInlineOffset = 2;
      lineNumberingService._currentLineNumber = 1;
      var out = lineNumberingService._textNodeToLines(textNode, 5);
      var outHtml = lineNumberingService._nodesToHtml(out);
      expect(outHtml).toBe('012' + brMarkup(1) + '34567' + brMarkup(2) + '89012' + brMarkup(3) + '34567');
      expect(lineNumberingService._currentInlineOffset).toBe(5);
    });

    it('breaks simple lines with offset equaling to length', function () {
      var textNode = document.createTextNode("012345678901234567");
      lineNumberingService._currentInlineOffset = 5;
      lineNumberingService._currentLineNumber = 1;
      var out = lineNumberingService._textNodeToLines(textNode, 5);
      var outHtml = lineNumberingService._nodesToHtml(out);
      expect(outHtml).toBe(brMarkup(1) + '01234' + brMarkup(2) + '56789' + brMarkup(3) + '01234' + brMarkup(4) + '567');
      expect(lineNumberingService._currentInlineOffset).toBe(3);
    });

    it('breaks simple lines with spaces (1)', function () {
      var textNode = document.createTextNode("0123 45 67 89012 34 567");
      lineNumberingService._currentInlineOffset = 0;
      lineNumberingService._currentLineNumber = 1;
      var out = lineNumberingService._textNodeToLines(textNode, 5);
      var outHtml = lineNumberingService._nodesToHtml(out);
      expect(outHtml).toBe('0123 ' + brMarkup(1) + '45 67 ' + brMarkup(2) + '89012 ' + brMarkup(3) + '34 ' + brMarkup(4) + '567');
      expect(lineNumberingService._currentInlineOffset).toBe(3);
    });

    it('breaks simple lines with spaces (2)', function () {
      var textNode = document.createTextNode("0123 45 67 89012tes 344 ");
      lineNumberingService._currentInlineOffset = 0;
      lineNumberingService._currentLineNumber = 1;
      var out = lineNumberingService._textNodeToLines(textNode, 5);
      var outHtml = lineNumberingService._nodesToHtml(out);
      expect(outHtml).toBe('0123 ' + brMarkup(1) + '45 67 ' + brMarkup(2) + '89012' + brMarkup(3) + 'tes ' + brMarkup(4) + '344 ');
      expect(lineNumberingService._currentInlineOffset).toBe(4);
    });

    it('breaks simple lines with spaces (3)', function () {
      var textNode = document.createTextNode("I'm a Demo-Text");
      lineNumberingService._currentInlineOffset = 0;
      lineNumberingService._currentLineNumber = 1;
      var out = lineNumberingService._textNodeToLines(textNode, 5);
      var outHtml = lineNumberingService._nodesToHtml(out);
      expect(outHtml).toBe('I\'m a ' + brMarkup(1) + 'Demo-' + brMarkup(2) + 'Text');
      expect(lineNumberingService._currentInlineOffset).toBe(4);
    });

    it('breaks simple lines with spaces (4)', function () {
      var textNode = document.createTextNode("I'm a LongDemo-Text");
      lineNumberingService._currentInlineOffset = 0;
      lineNumberingService._currentLineNumber = 1;
      var out = lineNumberingService._textNodeToLines(textNode, 5);
      var outHtml = lineNumberingService._nodesToHtml(out);
      expect(outHtml).toBe('I\'m a ' + brMarkup(1) + 'LongD' + brMarkup(2) + 'emo-' + brMarkup(3) + 'Text');
      expect(lineNumberingService._currentInlineOffset).toBe(4);
    });
  });


  describe('line numbering: inline nodes', function () {
    it('leaves a simple SPAN untouched', function () {
      var inHtml = "<span>Test</span>";
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 5);
      expect(outHtml).toBe(noMarkup(1) + '<span>Test</span>');
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('breaks lines in a simple SPAN', function () {
      var inHtml = "<span>Lorem ipsum dolorsit amet</span>";
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 5);
      expect(outHtml).toBe(noMarkup(1) + '<span>Lorem ' + brMarkup(2) + 'ipsum ' + brMarkup(3) + 'dolor' + brMarkup(4) + 'sit ' + brMarkup(5) + 'amet</span>');
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('breaks lines in nested inline elements', function () {
      var inHtml = "<span>Lorem <strong>ipsum dolorsit</strong> amet</span>";
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 5);
      expect(outHtml).toBe(noMarkup(1) + '<span>Lorem ' + brMarkup(2) + '<strong>ipsum ' + brMarkup(3) + 'dolor' + brMarkup(4) + 'sit</strong> ' + brMarkup(5) + 'amet</span>');
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('counts within DEL nodes', function () {
      var inHtml = "1234 <del>1234</del> 1234 1234";
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 10);
      expect(outHtml).toBe(noMarkup(1) + '1234 <del>1234</del> ' + brMarkup(2) + '1234 1234');
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('counts after DEL/INS-nodes', function () {
        var inHtml = "<P>leo Testelefantgeweih Buchstabenwut als Achzehnzahlunginer. Hierbei <DEL>darf</DEL><INS>setzen</INS> bist der Deifi <DEL>das </DEL><INS>Dor Reh Wachtel da </INS>Subjunktivier <DEL>als Derftige Aal</DEL><INS>san</INS> Orthopädische<DEL>, der Arbeitsnachweisdiskus Bass der Tastatur </DEL><DEL>Weiter schreiben wie Tasse Wasser als</DEL><INS> dienen</INS>.</P>";
        var outHtml = lineNumberingService.insertLineNumbers(inHtml, 95);
        expect(outHtml).toBe('<p>' + noMarkup(1) + 'leo Testelefantgeweih Buchstabenwut als Achzehnzahlunginer. Hierbei <del>darf</del><ins>setzen</ins> bist der Deifi <del>das ' + brMarkup(2) + '</del><ins>Dor Reh Wachtel da </ins>Subjunktivier <del>als Derftige Aal</del><ins>san</ins> Orthopädische<del>, der Arbeitsnachweisdiskus Bass der Tastatur </del>' + brMarkup(3) + '<del>Weiter schreiben wie Tasse Wasser als</del><ins> dienen</ins>.</p>');
    });

    it('handles STRIKE-tags', function () {
      var inHtml = '<p>et accusam et justo duo dolores et ea <span style="color: #ff0000;"><strike>rebum </strike></span><span style="color: #006400;">Inserted Text</span>. Stet clita kasd gubergren,</p>';
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 80);
      expect(outHtml).toBe('<p>' + noMarkup(1) + 'et accusam et justo duo dolores et ea <span style="color: #ff0000;"><strike>rebum </strike></span><span style="color: #006400;">Inserted Text</span>. Stet clita kasd ' + brMarkup(2) + 'gubergren,</p>');
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('treats ascii newline characters like spaces', function () {
      var inHtml = "<p>Test 123\nTest1</p>";
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 5);
      expect(outHtml).toBe('<p>' + noMarkup(1) + 'Test ' + brMarkup(2) + "123\n" + brMarkup(3) + 'Test1</p>');
    });
  });


  describe('line numbering: block nodes', function () {
    it('leaves a simple DIV untouched', function () {
      var inHtml = "<div>Test</div>";
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 5);
      expect(outHtml).toBe('<div>' + noMarkup(1) + 'Test</div>');
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('breaks a DIV containing only inline elements', function () {
      var inHtml = "<div>Test <span>Test1234</span>5678 Test</div>";
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 5);
      expect(outHtml).toBe('<div>' + noMarkup(1) + 'Test ' + brMarkup(2) + '<span>Test1' + brMarkup(3) + '234</span>56' + brMarkup(4) + '78 ' + brMarkup(5) + 'Test</div>');
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('handles a DIV within a DIV correctly', function () {
      var inHtml = "<div>Te<div>Te Test</div>Test</div>";
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 5);
      expect(outHtml).toBe('<div>' + noMarkup(1) + 'Te<div>' + noMarkup(2) + 'Te ' + brMarkup(3) + 'Test</div>' + noMarkup(4) + 'Test</div>');
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('ignores white spaces between block element tags', function () {
      var inHtml = "<ul>\n<li>Test</li>\n</ul>";
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 80);
      expect(outHtml).toBe("<ul>\n<li>" + noMarkup(1) + 'Test</li>\n</ul>');
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });
  });


  describe('indentation for block elements', function () {
    it('indents LI-elements', function () {
      var inHtml = '<div>' +longstr(100) + '<ul><li>' + longstr(100) + '</li></ul>' + longstr(100) + '</div>';
      var expected = '<div>' + noMarkup(1) +
          'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZAB' + brMarkup(2) + 'CDEFGHIJKLMNOPQRSTUV' +
          '<ul><li>' + noMarkup(3) +
          'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVW' + brMarkup(4) + 'XYZABCDEFGHIJKLMNOPQRSTUV' +
          '</li></ul>' + noMarkup(5) +
          'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZAB' + brMarkup(6) + 'CDEFGHIJKLMNOPQRSTUV</div>';
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 80);
      expect(outHtml).toBe(expected);
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('indents BLOCKQUOTE-elements', function () {
      var inHtml = '<div>' +longstr(100) + '<blockquote>' + longstr(100) + '</blockquote>' + longstr(100) + '</div>';
      var expected = '<div>' + noMarkup(1) +
          'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZAB' + brMarkup(2) + 'CDEFGHIJKLMNOPQRSTUV' +
          '<blockquote>' + noMarkup(3) +
          'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGH' + brMarkup(4) + 'IJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUV' +
          '</blockquote>' + noMarkup(5) +
          'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZAB' + brMarkup(6) + 'CDEFGHIJKLMNOPQRSTUV</div>';
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 80);
      expect(outHtml).toBe(expected);
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('shortens the line for H1-elements by 2/3', function () {
      var inHtml = '<h1>' + longstr(80) + '</h1>';
      var expected = '<h1>' + noMarkup(1) + 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZA' +
          brMarkup(2) + 'BCDEFGHIJKLMNOPQRSTUVWXYZAB</h1>';
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 80);
      expect(outHtml).toBe(expected);
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('shortens the line for H2-elements by 0.75', function () {
      var inHtml = '<h2>' + longstr(80) + '</h2>';
      var expected = '<h2>' + noMarkup(1) + 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGH' +
          brMarkup(2) + 'IJKLMNOPQRSTUVWXYZAB</h2>';
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 80);
      expect(outHtml).toBe(expected);
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('indents Ps with 30px-padding by 6 characters', function () {
      var inHtml = '<div style="padding-left: 30px;">' + longstr(80) + '</div>';
      var expected = '<div style="padding-left: 30px;">' + noMarkup(1) + 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUV' +
          brMarkup(2) + 'WXYZAB</div>';
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 80);
      expect(outHtml).toBe(expected);
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('breaks before an inline element, if the first word of the new inline element is longer than the remaining line (1)', function () {
      var inHtml = "<p>Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie <strong>consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio</strong>.</p>";
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 80);
      expect(outHtml).toBe('<p>' + noMarkup(1) + 'Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie ' + brMarkup(2) + '<strong>consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan ' + brMarkup(3) + 'et iusto odio</strong>.</p>');
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('breaks before an inline element, if the first word of the new inline element is longer than the remaining line (2)', function () {
      var inHtml = "<p><span>Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie <strong>consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio</strong>.</span></p>";
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 80);
      expect(outHtml).toBe('<p>' + noMarkup(1) + '<span>Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie ' + brMarkup(2) + '<strong>consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan ' + brMarkup(3) + 'et iusto odio</strong>.</span></p>');
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('does not fail in a weird case', function () {
      var inHtml = "<ins>seid Noch</ins><p></p><p><ins>Test 123</ins></p>";
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 80);
      expect(outHtml).toBe(noMarkup(1) + '<ins>seid Noch</ins><p></p><p>' + noMarkup(2) + '<ins>Test 123</ins></p>');
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });
  });

  describe('line numbering in regard to the inline diff', function() {
    it('does not count within INS nodes', function () {
      var inHtml = "1234 <ins>1234</ins> 1234 1234";
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 10);
      expect(outHtml).toBe(noMarkup(1) + '1234 <ins>1234</ins> 1234 ' + brMarkup(2) + '1234');
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('does not create a new line for a trailing INS', function () {
      var inHtml = "<p>et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur<ins>dsfsdf23</ins></p>";
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 80);
      expect(outHtml).toBe('<p>' + noMarkup(1) + 'et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata ' + brMarkup(2) + 'sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur<ins>dsfsdf23</ins></p>');
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('inserts the line number before the INS, if INS is the first element of the paragraph', function() {
        var inHtml = "<p><ins>lauthals </ins>'liebe Kinder, ich will hinaus in den Wald, seid auf der Hut vor dem Wolf!' Und noch etwas mehr Text bis zur nächsten Zeile</p>";
        var outHtml = lineNumberingService.insertLineNumbers(inHtml, 80);
        expect(outHtml).toBe("<p>" + noMarkup(1) + "<ins>lauthals </ins>'liebe Kinder, ich will hinaus in den Wald, seid auf der Hut vor dem Wolf!' Und " + brMarkup(2) + "noch etwas mehr Text bis zur nächsten Zeile</p>");
        expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
        expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('cancels newlines after br-elements', function () {
      var inHtml = "<p>Test 123<br>\nTest 456</p>";
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 80);
      expect(outHtml).toBe("<p>" + noMarkup(1) + "Test 123<br>" + noMarkup(2) + "Test 456</p>");
    });

    it('does not force-break words right after an INS', function () {
      var inHtml = "<p>" + noMarkup(1) + "012345 <ins>78 01 34567</ins>8901234567890123456789</p>";
      var outHtml = lineNumberingService.insertLineBreaksWithoutNumbers(inHtml, 20, true);
      expect(outHtml).toBe("<p>" + noMarkup(1) + "012345 <ins>78 01 <br class=\"os-line-break\">34567</ins>890123456789012<br class=\"os-line-break\">3456789</p>");
    });
  });

  describe('line breaking without adding line numbers', function() {
    var plainBr = '<br class="os-line-break">';

    it('breaks a DIV containing only inline elements', function () {
      var inHtml = "<div>Test <span>Test1234</span>5678 Test</div>";
      var outHtml = lineNumberingService.insertLineBreaksWithoutNumbers(inHtml, 5);
      expect(outHtml).toBe('<div>Test ' + plainBr + '<span>Test1' + plainBr + '234</span>56' + plainBr + '78 ' + plainBr + 'Test</div>');
      expect(lineNumberingService.stripLineNumbers(outHtml)).toBe(inHtml);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('indents BLOCKQUOTE-elements', function () {
      var inHtml = '<div>' + longstr(100) + '<blockquote>' + longstr(100) + '</blockquote>' + longstr(100) + '</div>';
      var expected = '<div>' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZAB' + plainBr + 'CDEFGHIJKLMNOPQRSTUV' +
          '<blockquote>' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGH' + plainBr + 'IJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUV' +
          '</blockquote>' +  'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZAB' + plainBr + 'CDEFGHIJKLMNOPQRSTUV</div>';
      var outHtml = lineNumberingService.insertLineBreaksWithoutNumbers(inHtml, 80);
      expect(outHtml).toBe(expected);
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('DOES count within INS nodes', function () {
      var inHtml = "1234 <ins>1234</ins> 1234 1234";
      var outHtml = lineNumberingService.insertLineBreaksWithoutNumbers(inHtml, 10, true);
      expect(outHtml).toBe('1234 <ins>1234</ins> ' + plainBr + '1234 1234');
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('does not create a new line for a trailing INS', function () {
      var inHtml = "<p>et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur<ins>dsfsdf23</ins></p>";
      var outHtml = lineNumberingService.insertLineBreaksWithoutNumbers(inHtml, 80, true);
      expect(outHtml).toBe('<p>et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata ' +
          plainBr + 'sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur' +
          plainBr + '<ins>dsfsdf23</ins></p>');
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });

    it('ignores witespaces by previously added line numbers', function () {
      var inHtml = "<p>" + noMarkup(1) + longstr(10) + "</p>";
      var outHtml = lineNumberingService.insertLineBreaksWithoutNumbers(inHtml, 10, true);
      expect(outHtml).toBe("<p>" + noMarkup(1) + longstr(10) + "</p>");
      expect(lineNumberingService.insertLineBreaksWithoutNumbers(outHtml, 80)).toBe(outHtml);
    });
  });

  describe('behavior regarding ckeditor', function() {
    it('does not count empty lines, case 1', function () {
      var inHtml = "<p>Line 1</p>\n\n<p>Line 2</p>";
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 80);
      expect(outHtml).toBe('<p>' + noMarkup(1) + 'Line 1</p>' + "\n\n" + '<p>' + noMarkup(2) + 'Line 2</p>');
    });

    it('does not count empty lines, case 2', function () {
      var inHtml = "<ul>\n\n<li>Point 1</li>\n\n</ul>";
      var outHtml = lineNumberingService.insertLineNumbers(inHtml, 80);
      expect(outHtml).toBe("<ul>\n\n<li>" + noMarkup(1) + "Point 1</li>\n\n</ul>");
    });
  });

  describe('line highlighting', function() {
    it('highlights a simple line', function () {
        var inHtml = lineNumberingService.insertLineNumbers("<span>Lorem ipsum dolorsit amet</span>", 5);
        var highlighted = lineNumberingService.highlightLine(inHtml, 2);
        expect(highlighted).toBe(noMarkup(1) + '<span>Lorem ' + brMarkup(2) + '<span class="highlight">ipsum </span>' + brMarkup(3) + 'dolor' + brMarkup(4) + 'sit ' + brMarkup(5) + 'amet</span>');
    });

    it('highlights a simple line with formattings', function () {
        var inHtml = lineNumberingService.insertLineNumbers("<span>Lorem ipsum <strong>dolorsit amet Lorem</strong><em> ipsum dolorsit amet</em> Lorem ipsum dolorsit amet</span>", 20);
        expect(inHtml).toBe(noMarkup(1) + '<span>Lorem ipsum <strong>dolorsit ' +
            brMarkup(2) + 'amet Lorem</strong><em> ipsum ' +
            brMarkup(3) + 'dolorsit amet</em> Lorem ' + brMarkup(4) + 'ipsum dolorsit amet</span>');

        var highlighted = lineNumberingService.highlightLine(inHtml, 2);
        expect(highlighted).toBe(noMarkup(1) + '<span>Lorem ipsum <strong>dolorsit ' +
            brMarkup(2) + '<span class="highlight">amet Lorem</span></strong><em><span class="highlight"> ipsum </span>' +
            brMarkup(3) + 'dolorsit amet</em> Lorem ' + brMarkup(4) + 'ipsum dolorsit amet</span>');
    });

    it('highlights the last line', function () {
        var inHtml = lineNumberingService.insertLineNumbers("<span>Lorem ipsum dolorsit amet</span>", 5);
        var highlighted = lineNumberingService.highlightLine(inHtml, 5);
        expect(highlighted).toBe(noMarkup(1) + '<span>Lorem ' + brMarkup(2) + 'ipsum ' + brMarkup(3) + 'dolor' + brMarkup(4) + 'sit ' + brMarkup(5) + '<span class="highlight">amet</span></span>');
    });

    it('highlights the first line', function () {
        var inHtml = lineNumberingService.insertLineNumbers("<span>Lorem ipsum dolorsit amet</span>", 5);
        var highlighted = lineNumberingService.highlightLine(inHtml, 1);
        expect(highlighted).toBe(noMarkup(1) + '<span><span class="highlight">Lorem </span>' + brMarkup(2) + 'ipsum ' + brMarkup(3) + 'dolor' + brMarkup(4) + 'sit ' + brMarkup(5) + 'amet</span>');
    });

    it('does not change the string if the line number is not found', function () {
        var inHtml = lineNumberingService.insertLineNumbers("<span>Lorem ipsum dolorsit amet</span>", 5);
        var highlighted = lineNumberingService.highlightLine(inHtml, 8);
        expect(highlighted).toBe(noMarkup(1) + '<span>Lorem ' + brMarkup(2) + 'ipsum ' + brMarkup(3) + 'dolor' + brMarkup(4) + 'sit ' + brMarkup(5) + 'amet</span>');
    });
  });

  describe('document structure parsing', function () {
    it('detects the line numbers of headings', function () {
      var inHtml = '<p>Line 1</p>' +
          '<h1>Heading 1</h1><p>Line 2</p><h2>Heading 1.1</h2><p>Line 3</p><h2>Heading 1.2</h2><p>Line 4</p>' +
          '<h1>Heading 2</h1><h2>Heading 2.1</h2><p>Line 5</p>';
      inHtml = lineNumberingService.insertLineNumbers(inHtml, 80);
      var structure = lineNumberingService.getHeadingsWithLineNumbers(inHtml);
      expect(structure).toEqual([
          {lineNumber: 2, level: 1, text: 'Heading 1'},
          {lineNumber: 4, level: 2, text: 'Heading 1.1'},
          {lineNumber: 6, level: 2, text: 'Heading 1.2'},
          {lineNumber: 8, level: 1, text: 'Heading 2'},
          {lineNumber: 9, level: 2, text: 'Heading 2.1'}
      ]);
    });
  });

  describe('caching', function() {
    it('caches based on line length', function () {
      var inHtml = '<p>' +longstr(100) + '</p>';
      var outHtml80 = lineNumberingService.insertLineNumbers(inHtml, 80);
      var outHtml70 = lineNumberingService.insertLineNumbers(inHtml, 70);
      expect(outHtml70).not.toBe(outHtml80);
    });
  });
});
