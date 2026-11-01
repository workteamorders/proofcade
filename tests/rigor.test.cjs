require('./register.cjs');
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { parseRigor, validStatement } = require('../lib/rigor.ts');
const path = require.resolve('../app/api/rigor/route.ts');
const realFetch = global.fetch;
let calls;
const load = () => { delete require.cache[path]; return require(path); };
const reply = (text, ok = true) => ({ ok, status: ok ? 200 : 500, body: null, json: async () => ({ content: [{ type: 'text', text }] }) });
const STMT = 'For every even integer n, n squared is even.';
const get = (route, s = STMT, ip = '1.1.1.1') => route.GET(new Request(`https://theorema.fun/api/rigor?s=${encodeURIComponent(s)}`, { headers: { 'x-forwarded-for': ip } }));

beforeEach(() => { calls = []; process.env.ANTHROPIC_API_KEY = 'test-key'; delete process.env.RIGOR_MODEL; delete process.env.RIGOR_DAILY_CAP; });
afterEach(() => { global.fetch = realFetch; delete process.env.ANTHROPIC_API_KEY; delete process.env.RIGOR_DAILY_CAP; delete process.env.RIGOR_MODEL; delete require.cache[path]; });

test('parseRigor accepts a whole score from 0 to 100 and trims the reason', () => {
  assert.deepEqual(parseRigor('{"score": 87, "reason": "  Clear   and  quantified. "}'), { score: 87, reason: 'Clear and quantified.' });
  assert.deepEqual(parseRigor('Here you go: {"score":0,"reason":"Not maths"}'), { score: 0, reason: 'Not maths' });
  assert.equal(parseRigor('{"score": 101}'), null);
  assert.equal(parseRigor('{"score": 7.5}'), null);
  assert.equal(parseRigor('{"score": "90"}'), null);
  assert.equal(parseRigor('no json'), null);
  assert.equal(parseRigor('{bad'), null);
});

test('validStatement needs 12 to 280 bytes', () => {
  assert.equal(validStatement('short'), false);
  assert.equal(validStatement(STMT), true);
  assert.equal(validStatement('x'.repeat(281)), false);
  assert.equal(validStatement('é'.repeat(141)), false);
});

test('scores a statement through the Anthropic API and caches it', async () => {
  global.fetch = async (url, init) => { calls.push({ url: String(url), init }); return reply('{"score": 91, "reason": "Precise."}'); };
  const route = load();
  const res = await get(route);
  assert.deepEqual(await res.json(), { score: 91, reason: 'Precise.' });
  assert.match(res.headers.get('cache-control'), /s-maxage=604800/);
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(calls[0].init.headers['x-api-key'], 'test-key');
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.model, 'claude-haiku-5-5');
  assert.equal(sent.messages[0].content, `<statement>${STMT}</statement>`);
  await get(route);
  assert.equal(calls.length, 1);
});

test('uses RIGOR_MODEL when set', async () => {
  process.env.RIGOR_MODEL = 'claude-sonnet-5-5';
  global.fetch = async (url, init) => { calls.push(JSON.parse(init.body)); return reply('{"score": 70, "reason": ""}'); };
  await get(load());
  assert.equal(calls[0].model, 'claude-sonnet-5-5');
});

test('says it is switched off without an API key, and never calls out', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  global.fetch = async () => { calls.push(1); return reply('{}'); };
  assert.equal((await get(load())).status, 503);
  assert.equal(calls.length, 0);
});

test('refuses statements that are too short or too long before spending anything', async () => {
  global.fetch = async () => { calls.push(1); return reply('{}'); };
  const route = load();
  assert.equal((await get(route, 'hi')).status, 400);
  assert.equal((await get(route, 'x'.repeat(300))).status, 400);
  assert.equal(calls.length, 0);
});

test('returns 502, uncached, when the model answers badly or the API fails', async () => {
  let n = 0;
  global.fetch = async () => (++n === 1 ? reply('I think it is good.') : n === 2 ? reply('', false) : reply('{"score": 55, "reason": "ok"}'));
  const route = load();
  assert.equal((await get(route)).status, 502);
  assert.equal((await get(route)).status, 502);
  assert.equal((await get(route)).status, 200);
});

test('stops at the daily cap but still serves cached statements', async () => {
  process.env.RIGOR_DAILY_CAP = '1';
  global.fetch = async () => { calls.push(1); return reply('{"score": 80, "reason": "ok"}'); };
  const route = load();
  assert.equal((await get(route, STMT)).status, 200);
  assert.equal((await get(route, 'Every prime greater than two is odd.')).status, 429);
  assert.equal((await get(route, STMT)).status, 200);
  assert.equal(calls.length, 1);
});

test('limits misses from one address per hour', async () => {
  global.fetch = async () => reply('{"score": 80, "reason": "ok"}');
  const route = load();
  const codes = [];
  for (let i = 0; i < 42; i++) codes.push((await get(route, `Statement number ${i} is a fresh one.`, '8.8.8.8')).status);
  assert.equal(codes.filter((c) => c === 200).length, 40);
  assert.equal(codes[41], 429);
});
