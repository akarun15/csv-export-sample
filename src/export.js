// CSV helpers for GET /expenses/export.csv. Plain functions, no Express.

const HEADER = 'date,category,amount,note';

// Quote a note only when it holds a comma, a double quote or a newline; double any quotes inside.
function csvField(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Dates are written exactly as stored (ISO 8601, YYYY-MM-DD), never locale-formatted.
function toCsv(rows) {
  const lines = rows.map((r) => [r.date, r.category, r.amount, csvField(r.note)].join(','));
  return [HEADER, ...lines].join('\n') + '\n';
}

module.exports = { HEADER, csvField, toCsv };
