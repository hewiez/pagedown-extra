(function () {
  Markdown.Extra = {};

  // for converting internal markdown (in tables for instance).
  // this is necessary since these methods are meant to be called as
  // preConversion hooks, and the Markdown converter won't convert
  // any markdown contained in the html we return
  var conv = Markdown.getSanitizingConverter();

  // TODO; option to add a class to tables, or root output element

  Markdown.Extra.setConverter = function(converter) {
    conv = converter;
  };

  function strip(str) {
    return str.replace(/^\s+|\s+$/g, '');
  }

  function sanitizeTag(tag, whitelist) {
    if (tag.match(whitelist))
      return tag;
    return '';
  }

  function sanitizeHtml(html, whitelist) {
    return html.replace(/<[^>]*>?/gi, function(match) {
      return sanitizeTag(match, whitelist);
    });
  }

  Markdown.Extra.tables = function(text) {
    var _blocks = [],
        _blockdata = [],
        _lines = text.split('\n'),
        _whitelist = /^(<\/?(b|del|em|i|s|sup|sub|strong|strike)>|<(br)\s?\/?>)$/i;
        // I'm using this whitelist as a post-processing step after calling convert.makeHtml()
        // to keep only span-level tags per the PHP Markdown Extra spec.

    function convertInline(text) {
      var html = conv.makeHtml(text);
      return sanitizeHtml(html, _whitelist);
    }

    function splitRow(row, border) {
      var r = strip(row);
      if (border) {
        if (r.indexOf('|') === 0)
          r = r.slice(1);
        if (r.lastIndexOf('|') === r.length - 1)
          r = r.slice(0, -1);
      }

      var cols = r.split('|');
      for (var i = 0; i < cols.length; i++)
        cols[i] = strip(cols[i]);

      return cols;
    }

    function buildRow(line, border, align, isHeader) {
      var rowHtml = '<tr>';
      var cols = splitRow(line, border);
      var style, cellStart, cellEnd, content;

      // use align to ensure each row has same number of columns
      for (var i = 0; i < align.length; i++) {
        style = align[i] && !isHeader ? ' style="text-align:' + align[i] + ';"' : '';
        cellStart = isHeader ? '<th'+style+'>' : '<td'+style+'>';
        cellEnd = isHeader ? "</th>" : "</td>";
        content = i < cols.length ? convertInline(cols[i]) : '';
        rowHtml += cellStart + content + cellEnd;
      }

      return rowHtml + "</tr>";
    }

   // find blocks (groups of lines matching our definition of a table)
   function findBlocks() {
      // find block potentially containing tables
      var b = [], ndx = 0, bounds = {};
      for (var i = 0; i < _lines.length; i++) {
        var line = _lines[i];
        // TODO: add ability to escape |, : per PHP Markdown Extra spec
        // TODO: use a regex to find blocks. make sure blocks end with blank line
        if (line.indexOf('|') != -1 && (ndx != 1 || line.indexOf('-') != -1)) {
            if (typeof bounds.start == "undefined")
              bounds.start = i;
            b.push(line);
            ndx++;
        } else { // invalid line
          if (b.length > 2) {// need head, sep, body
            _blocks.push(b);
            bounds.end = i - 1;
            _blockdata.push(bounds);
          }
          b = [];
          bounds = {};
          ndx = 0;
        }
      }
    }

    function makeTables() {
      findBlocks();
      for (var i = 0; i < _blocks.length; i++) {
        var block = _blocks[i],
            header = strip(block[0]);
            sep = strip(block[1]);
            rows = strip(block[2]);
            border = false;

        if (header.indexOf('|') === 0 ||
            header.lastIndexOf('|') === header.length-1)
          border = true;

        var align = [],
            cols = splitRow(sep, border);

        // determine alignment of columns
        for (var j = 0; j < cols.length; j++) {
          var c = cols[j];
          if (c.indexOf(':') === 0 && c.lastIndexOf(':') == c.length - 1)
            align.push('center');
          else if (c.indexOf(':') === 0)
            align.push('left');
          else if (c.lastIndexOf(':') === c.length - 1)
            align.push('right');
          else
            align.push(null);
        }

        // build html
        var tableHtml = '<table class="wmd-table">' + buildRow(block[0], border, align, true);
        for (j = 2; j < block.length; j++)
          tableHtml += buildRow(block[j], border, align, false);
        tableHtml += "</table>\n";

        var toRemove = _blockdata[i].end - _blockdata[i].start + 1;
        _lines.splice(_blockdata[i].start, toRemove, tableHtml);
      }
      return _lines.join('\n');
    }

    return makeTables();
  }; // Markdown.Extra.tables

})();

