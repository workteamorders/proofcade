require('./register.cjs');
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const path = require.resolve('../app/api/price/route.ts');
const realFetch = global.fetch;
let calls;
const load = () => { delete require.cache[path]; return require(path); };
const respond = (body, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });
const pyth = (price, expo = -8) => respond({ parsed: [{ price: { price: String(price), expo } }] });

beforeEach(() => { calls = []; delete process.env.NEXT_PUBLIC_SOL_USD; });
afterEach(() => { global.fetch = realFetch; delete require.cache[path]; delete process.env.NEXT_PUBLIC_SOL_USD; });

test('uses the Pyth price and applies its exponent', async () => {
  global.fetch = async (url) => { calls.push(String(url)); return pyth(15234500000, -8); };
  const body = await (await load().GET()).json();
  assert.deepEqual([body.usd, body.source, body.live], [152.35, 'pyth', true]);
  assert.match(calls[0], /hermes\.pyth\.network/);
});

test('falls back to the next source when one fails or returns nonsense', async () => {
  global.fetch = async (url) => {
    calls.push(String(url));
    if (/pyth/.test(url)) throw new Error('down');
    if (/coingecko/.test(url)) return respond({ solana: { usd: -3 } });
    return respond({ data: { amount: '161.5' } });
  };
  const body = await (await load().GET()).json();
  assert.deepEqual([body.usd, body.source, body.live], [161.5, 'coinbase', true]);
  assert.equal(calls.length, 3);
});

test('serves the fixed rate, marked not live, when every source fails', async () => {
  process.env.NEXT_PUBLIC_SOL_USD = '175';
  global.fetch = async () => respond({}, false);
  const res = await load().GET();
  const body = await res.json();
  assert.deepEqual([body.usd, body.source, body.live], [175, 'fixed', false]);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('defaults to 150 when the fixed rate is missing or invalid', async () => {
  process.env.NEXT_PUBLIC_SOL_USD = 'abc';
  global.fetch = async () => { throw new Error('offline'); };
  assert.equal((await (await load().GET()).json()).usd, 150);
});

test('reuses a fresh quote instead of calling the feeds again', async () => {
  global.fetch = async (url) => { calls.push(String(url)); return pyth(14000000000); };
  const route = load();
  await route.GET();
  await route.GET();
  assert.equal(calls.length, 1);
});

test('keeps serving the last good quote when the feeds go down', async () => {
  let down = false;
  global.fetch = async () => { if (down) throw new Error('down'); return pyth(14000000000); };
  const route = load();
  await route.GET();
  down = true;
  const realNow = Date.now;
  Date.now = () => realNow() + 120_000;
  try {
    const body = await (await route.GET()).json();
    assert.deepEqual([body.usd, body.live], [140, true]);
  } finally { Date.now = realNow; }
});
