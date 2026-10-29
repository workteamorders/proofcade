require('./register.cjs');
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { POST, GET } = require('../app/api/rpc/route.ts');

const SITE = 'https://theorem.example';
const RPC = 'https://provider.example/?api-key=secret-test-key';
const MAX_BODY = 256 * 1024;
const originalFetch = global.fetch;
const envNames = ['SOLANA_RPC_URL', 'NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_SOLANA_CLUSTER'];
let savedEnv;
let calls;
const call = (method = 'getBalance', params = []) => ({ jsonrpc: '2.0', id: 1, method, params });
const request = (body = call(), headers = {}) => new Request(`${SITE}/api/rpc`, {
  method: 'POST', headers: { origin: SITE, 'content-type': 'application/json', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

beforeEach(() => {
  savedEnv = Object.fromEntries(envNames.map((key) => [key, process.env[key]]));
  process.env.SOLANA_RPC_URL = RPC;
  process.env.NEXT_PUBLIC_SITE_URL = SITE;
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER = 'devnet';
  calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ jsonrpc: '2.0', id: 1, result: 42 });
  };
});

afterEach(() => {
  global.fetch = originalFetch;
  for (const key of envNames) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

test('POST rejects missing, null, malformed, foreign and different-scheme origins', async () => {
  for (const origin of [undefined, 'null', 'not a URL', 'https://evil.example', 'http://theorem.example', `${SITE}/path`]) {
    const req = request();
    if (origin === undefined) req.headers.delete('origin');
    else req.headers.set('origin', origin);
    assert.equal((await POST(req)).status, 403, String(origin));
  }
  assert.equal(calls.length, 0);
});

test('POST ignores spoofed host headers and uses canonical origin or request URL', async () => {
  assert.equal((await POST(request(call(), { origin: 'https://evil.example', host: 'evil.example', 'x-forwarded-host': 'evil.example' }))).status, 403);
  assert.equal((await POST(request(call(), { host: 'internal.example', 'x-forwarded-host': 'evil.example' }))).status, 200);
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal((await POST(request())).status, 200);
  assert.equal((await POST(request(call(), { origin: 'https://evil.example', 'x-forwarded-host': 'evil.example' }))).status, 403);
});

test('POST rejects invalid JSON, envelopes, methods and batches before fetching', async () => {
  for (const body of ['{', null, 1, [], Array.from({ length: 26 }, () => call()), { ...call(), jsonrpc: '1.0' }, { ...call(), params: {} }, { ...call(), id: {} }]) {
    assert.equal((await POST(request(body))).status, 400, JSON.stringify(body));
  }
  for (const body of [call('getProgramAccounts'), call('requestAirdrop'), { jsonrpc: '2.0', id: 1 }, [call(), call('unknown')]]) {
    const response = await POST(request(body));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(calls.length, 0);
});

test('POST enforces byte limits, including untrusted Content-Length and streamed bodies', async () => {
  assert.equal((await POST(request(call(), { 'content-length': String(MAX_BODY + 1) }))).status, 413);
  const large = JSON.stringify(call('getBalance', ['\u00e9'.repeat(MAX_BODY / 2)]));
  assert.ok(large.length < MAX_BODY);
  assert.equal((await POST(request(large, { 'content-length': '1' }))).status, 413);
  let cancelled = false;
  let chunks = 0;
  const stream = new ReadableStream({
    pull(controller) { chunks++; controller.enqueue(new Uint8Array(64 * 1024).fill(32)); },
    cancel() { cancelled = true; },
  });
  const req = new Request(`${SITE}/api/rpc`, { method: 'POST', headers: { origin: SITE }, body: stream, duplex: 'half' });
  assert.equal((await POST(req)).status, 413);
  assert.equal(cancelled, true);
  assert.ok(chunks <= 6, 'stops reading once the limit is crossed');
  assert.equal(calls.length, 0);
});

test('POST handles interrupted request bodies safely', async () => {
  const stream = new ReadableStream({ start(controller) { controller.error(new Error('private failure')); } });
  const response = await POST(new Request(`${SITE}/api/rpc`, { method: 'POST', headers: { origin: SITE }, body: stream, duplex: 'half' }));
  assert.equal(response.status, 400);
  assert.doesNotMatch(await response.text(), /private failure/);
  assert.equal(calls.length, 0);
});

test('POST accepts the byte limit exactly and decodes split UTF-8 correctly', async () => {
  const text = JSON.stringify(call('getBalance', ['\u00e9']));
  const bytes = new TextEncoder().encode(text);
  const split = bytes.indexOf(0xc3) + 1;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.slice(0, split));
      controller.enqueue(bytes.slice(split));
      controller.close();
    },
  });
  assert.equal((await POST(new Request(`${SITE}/api/rpc`, { method: 'POST', headers: { origin: SITE }, body: stream, duplex: 'half' }))).status, 200);
  assert.equal(calls[0].options.body, text);
  const exact = JSON.stringify(call()).padEnd(MAX_BODY, ' ');
  assert.equal((await POST(request(exact))).status, 200);
});

test('POST preserves SDK single calls, 100-account reads and 25-transaction batches', async () => {
  const bodies = [call(), call('getMultipleAccounts', [Array(100).fill('11111111111111111111111111111111')]), Array.from({ length: 25 }, () => call('getTransaction', ['signature', { encoding: 'jsonParsed' }]))];
  for (const body of bodies) {
    const response = await POST(request(body));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { jsonrpc: '2.0', id: 1, result: 42 });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const sent = calls.at(-1);
    assert.equal(sent.url, RPC);
    assert.deepEqual(JSON.parse(sent.options.body), body);
    assert.equal(sent.options.cache, 'no-store');
    assert.equal(sent.options.redirect, 'error');
    assert.ok(sent.options.signal instanceof AbortSignal);
  }
});

test('POST fails safely on invalid server configuration', async () => {
  for (const url of ['invalid-secret-key', 'file:///private/secret', 'wss://provider.example/secret']) {
    process.env.SOLANA_RPC_URL = url;
    const response = await POST(request());
    assert.equal(response.status, 500);
    assert.equal((await response.json()).error.message, 'Invalid RPC configuration.');
  }
  process.env.NEXT_PUBLIC_SITE_URL = 'invalid-site-secret';
  assert.equal((await POST(request())).status, 500);
  assert.equal(calls.length, 0);
});

test('POST uses public Devnet fallback without a configured provider', async () => {
  delete process.env.SOLANA_RPC_URL;
  assert.equal((await POST(request())).status, 200);
  assert.equal(calls[0].url, 'https://api.devnet.solana.com/');
});

test('POST hides upstream network, timeout, HTTP and JSON errors', async () => {
  for (const mock of [
    async () => { throw new Error(RPC); },
    async () => { throw new DOMException(RPC, 'TimeoutError'); },
    async () => new Response(RPC, { status: 500 }),
    async () => new Response(RPC, { status: 200 }),
    async () => Response.json(null),
    async () => Response.json({}),
  ]) {
    global.fetch = mock;
    const response = await POST(request());
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /provider\.example|secret-test-key/);
  }
  global.fetch = async () => new Response(RPC, { status: 429 });
  assert.equal((await POST(request())).status, 429);
});

test('POST sanitizes provider JSON-RPC errors without changing codes or batch IDs', async () => {
  const error = { jsonrpc: '2.0', id: 7, error: { code: -32002, message: RPC, data: { url: RPC } } };
  for (const body of [error, [error, { jsonrpc: '2.0', id: 8, result: null }]]) {
    global.fetch = async () => Response.json(body);
    const response = await POST(request());
    const result = await response.json();
    const sanitized = Array.isArray(result) ? result[0] : result;
    assert.equal(sanitized.id, 7);
    assert.equal(sanitized.error.code, -32002);
    assert.doesNotMatch(JSON.stringify(result), /provider\.example|secret-test-key/);
  }
});

function healthFetch(hash = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG', account = { executable: true }) {
  global.fetch = async (url, options) => {
    const rpc = JSON.parse(options.body);
    calls.push({ url, options, rpc });
    return Response.json({ jsonrpc: '2.0', id: rpc.id, result: rpc.method === 'getGenesisHash' ? hash : { value: account } });
  };
}

test('POST and GET explicitly set a 10-second upstream timeout', async (t) => {
  const timeouts = [];
  t.mock.method(AbortSignal, 'timeout', (ms) => {
    timeouts.push(ms);
    return new AbortController().signal;
  });
  assert.equal((await POST(request())).status, 200);
  healthFetch();
  assert.equal((await GET()).status, 200);
  assert.deepEqual(timeouts, [10_000, 10_000]);
});

test('GET verifies configured cluster and executable program using only read-only calls', async () => {
  healthFetch();
  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'ok', cluster: 'devnet', expectedCluster: 'devnet', rpc: 'ok', programExecutable: true, launch: 'unknown' });
  assert.deepEqual(calls.map((c) => c.rpc.method), ['getGenesisHash', 'getAccountInfo']);
  assert.equal(calls[1].rpc.params[0], '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
  assert.equal(calls[0].options.signal, calls[1].options.signal);
  for (const sent of calls) {
    assert.equal(sent.options.cache, 'no-store');
    assert.ok(sent.options.signal instanceof AbortSignal);
  }
});

test('GET rejects wrong or unknown clusters before checking the program', async () => {
  for (const [hash, cluster] of [['5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d', 'mainnet-beta'], ['EtWTRABZaYq6iMfeYKouRu166VU2xqa1', 'unknown'], ['unknown-hash', 'unknown']]) {
    calls = [];
    healthFetch(hash);
    const response = await GET();
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.rpc, 'wrong-cluster');
    assert.equal(body.cluster, cluster);
    assert.equal(body.launch, 'unavailable');
    assert.equal(calls.length, 1);
  }
});

test('GET supports configured mainnet and marks missing/nonexecutable programs unavailable', async () => {
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER = 'mainnet-beta';
  healthFetch('5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d');
  assert.equal((await GET()).status, 200);
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER = 'devnet';
  for (const account of [null, { executable: false }]) {
    healthFetch(undefined, account);
    const response = await GET();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).launch, 'unavailable');
  }
});

test('GET hides configuration, provider and timeout failures and never caches them', async () => {
  process.env.SOLANA_RPC_URL = 'invalid-secret-key';
  let response = await GET();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).rpc, 'misconfigured');
  assert.equal(calls.length, 0);
  process.env.SOLANA_RPC_URL = RPC;
  for (const mock of [
    async () => { throw new DOMException(RPC, 'TimeoutError'); },
    async () => new Response(RPC, { status: 503 }),
    async () => Response.json({ error: { message: RPC } }),
    async () => Response.json({}),
  ]) {
    global.fetch = mock;
    response = await GET();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(await response.text(), /provider\.example|secret-test-key/);
  }
});
