const { test, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Work on a temp copy of the data so tests never touch data/expenses.json
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'expenses-')), 'expenses.json');
fs.copyFileSync(path.join(__dirname, '..', 'data', 'expenses.json'), tmp);
process.env.EXPENSES_FILE = tmp;

const app = require('../src/app');
const server = app.listen(0);
after(() => server.close());

function get(urlPath) {
  return new Promise((resolve, reject) => {
    http
      .get({ port: server.address().port, path: urlPath }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          const json = res.headers['content-type']?.includes('json') ? JSON.parse(body) : body;
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        });
      })
      .on('error', reject);
  });
}

const SEPT = '/expenses/export.csv?from=2026-09-01&to=2026-09-30';

function lines(csv) {
  return csv.split('\n').filter((l) => l !== '');
}

test('GET /expenses/export.csv returns the header and 18 September rows in date order', async () => {
  const res = await get(SEPT);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers['content-type'], 'text/csv; charset=utf-8');
  const [header, ...rows] = lines(res.body);
  assert.strictEqual(header, 'date,category,amount,note');
  assert.strictEqual(rows.length, 18);
  const dates = rows.map((r) => r.slice(0, 10));
  assert.ok(dates.every((d) => /^2026-09-\d{2}$/.test(d)), 'every date is ISO YYYY-MM-DD in September');
  assert.deepStrictEqual(dates, [...dates].sort());
});

test('GET /expenses/export.csv quotes a note that contains a comma', async () => {
  const res = await get(SEPT);
  const row = lines(res.body).find((l) => l.startsWith('2026-09-05') && l.includes('Groceries'));
  assert.ok(row, 'the 2026-09-05 groceries row is present');
  assert.ok(row.endsWith(',"Groceries: rice, dal, oil"'), row);
});

test('GET /expenses/export.csv sets Content-Disposition with the range in the filename', async () => {
  const res = await get(SEPT);
  assert.strictEqual(
    res.headers['content-disposition'],
    'attachment; filename="expenses-2026-09-01-2026-09-30.csv"'
  );
});

test('GET /expenses/export.csv rejects missing, invalid or reversed dates with 400', async () => {
  for (const q of [
    '',
    '?from=2026-09-01',
    '?from=2026-09-01&to=2026-13-45',
    '?from=2026-02-30&to=2026-03-31',
    '?from=05/09/2026&to=2026-09-30',
    '?from=2026-09-30&to=2026-09-01',
  ]) {
    const res = await get('/expenses/export.csv' + q);
    assert.strictEqual(res.status, 400, q);
    assert.strictEqual(typeof res.body.error, 'string', q);
  }
});

test('GET /expenses/export.csv returns only the header for an empty range', async () => {
  const res = await get('/expenses/export.csv?from=2030-01-01&to=2030-01-31');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(lines(res.body), ['date,category,amount,note']);
});
