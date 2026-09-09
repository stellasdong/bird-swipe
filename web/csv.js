// RFC 4180 CSV parse / serialize.
//
// Written rather than vendored because the app must work offline (so a CDN
// script tag is out) and a minified blob in the repo buys little over ~50
// reviewable lines. Handles the things real Macaulay exports contain: a UTF-8
// BOM, quoted fields with embedded commas, doubled quotes, embedded newlines,
// and CRLF or LF line endings.

/** Split CSV text into an array of string arrays. Blank rows are dropped. */
export function parseRows(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false; // this field was quoted (so "" is a real empty string)
  let inQuotes = false;
  let i = 0;

  const endField = () => { row.push(field); field = ''; quoted = false; };
  const endRow = () => {
    const wasQuoted = quoted; // endField() clears it
    endField();
    // A blank line parses as one empty field; drop it (matches csv.DictReader).
    // A quoted "" is a real single-column row, so keep that.
    if (row.length > 1 || row[0] !== '' || wasQuoted) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; quoted = true; i++; continue; }
    if (ch === ',') { endField(); i++; continue; }
    if (ch === '\r') { if (text[i + 1] === '\n') i++; endRow(); i++; continue; }
    if (ch === '\n') { endRow(); i++; continue; }
    field += ch; i++;
  }
  // Trailing content with no final newline.
  if (field !== '' || quoted || row.length) endRow();
  return rows;
}

/** Parse into {rows: [{col: value}], fieldnames: [...]}. */
export function parseTable(text) {
  const raw = parseRows(text);
  if (!raw.length) return { rows: [], fieldnames: [] };
  const fieldnames = raw[0].map(h => (h == null ? '' : h));
  const rows = raw.slice(1).map(cells => {
    const obj = {};
    fieldnames.forEach((name, i) => { obj[name] = i < cells.length ? cells[i] : ''; });
    return obj;
  });
  return { rows, fieldnames };
}

const needsQuote = /[",\r\n]/;

function escapeCell(value) {
  const s = value == null ? '' : String(value);
  return needsQuote.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}

/**
 * Serialize rows to CSV text. Uses CRLF and a trailing newline to match what
 * Python's csv.DictWriter produces, so output stays byte-comparable with the
 * desktop app's files.
 */
export function serializeTable(fieldnames, rows) {
  const lines = [fieldnames.map(escapeCell).join(',')];
  for (const row of rows) lines.push(fieldnames.map(f => escapeCell(row[f])).join(','));
  return lines.join('\r\n') + '\r\n';
}
