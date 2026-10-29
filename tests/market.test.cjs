require('./register.cjs');

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PublicKey } = require('@solana/web3.js');

const key = (n) => new PublicKey(Buffer.alloc(32, n));
const mint = key(1).toBase58();
const creator = key(2);
const attacker = key(3);
const global = { initialVirtualTokenReserves: { isZero: () => true } };
const pumpPath = require.resolve('../lib/sol/pump.ts');
const originalPump = require.cache[pumpPath];
require.cache[pumpPath] = {
  id: pumpPath,
  filename: pumpPath,
  loaded: true,
  exports: {
    online: () => ({ fetchGlobal: async () => global, fetchFeeConfig: async () => null }),
    bondingCurvePda: (id) => new PublicKey(id),
    PUMP_SDK: { decodeBondingCurveNullable: (account) => account.curve },
    priceOf: () => 0.01,
    progressOf: () => 0.5,
    toSol: (n) => Number(n) / 1e9,
    toTokens: (n) => Number(n) / 1e6,
  },
};
const { readMarket } = require('../lib/sol/market.ts');
if (originalPump) require.cache[pumpPath] = originalPump;
else delete require.cache[pumpPath];

const memo = (overrides = {}) => ({ t: 'theorem/1', m: mint, n: 'Real theorem', s: 'REAL', x: 'Every prime has a successor.', ...overrides });
const transaction = (value, payer = creator, time = Math.floor(Date.now() / 1000)) => ({
  meta: { err: null },
  blockTime: time,
  transaction: { message: {
    accountKeys: [{ pubkey: payer, signer: true }],
    instructions: [{ program: 'spl-memo', parsed: JSON.stringify(value) }],
  } },
});
const curve = { creator, tokenTotalSupply: 1e15, realQuoteReserves: 1e9, complete: false };

// Only these read-only RPC methods are available; no network or signing is used.
function connection(txs, accounts = new Map([[mint, curve]])) {
  const calls = { signatures: [], transactions: [], accounts: [] };
  return {
    calls,
    getSignaturesForAddress: async (_tag, options) => {
      calls.signatures.push(options);
      return [...txs.keys()].map((signature) => ({ signature, err: null }));
    },
    getParsedTransactions: async (sigs) => {
      calls.transactions.push(sigs);
      return sigs.map((sig) => txs.get(sig) ?? null);
    },
    getMultipleAccountsInfo: async (keys) => {
      const ids = keys.map((k) => k.toBase58());
      calls.accounts.push(ids);
      return ids.map((id) => accounts.has(id) ? { curve: accounts.get(id) } : null);
    },
  };
}

test('ingests a valid creator launch and its live curve', async () => {
  const conn = connection(new Map([['launch', transaction(memo())]]));
  const market = await readMarket(conn);
  assert.equal(market.coins.length, 1);
  assert.equal(market.coins[0].id, mint);
  assert.equal(market.coins[0].name, 'Real theorem');
  assert.equal(market.coins[0].ticker, 'REAL');
  assert.equal(market.known[mint].creator, creator.toBase58());
  assert.deepEqual(market.pending, {});
  assert.equal(market.newest, 'launch');
});

test('rejects malformed and noncanonical mints without poisoning valid records', async (t) => {
  for (const bad of ['not-a-public-key', '__proto__', 'constructor', 'toString', '', ` ${mint}`, `1${mint}`]) {
    await t.test(JSON.stringify(bad), async () => {
      const conn = connection(new Map([
        ['invalid', transaction(memo({ m: bad }))],
        ['valid', transaction(memo())],
      ]));
      const market = await readMarket(conn);
      assert.deepEqual(market.coins.map((c) => c.id), [mint]);
      assert.ok(conn.calls.accounts.flat().every((id) => id === mint));
      assert.deepEqual(market.pending, {});
    });
  }
});

test('rejects invalid object schemas, names, tickers, and statements per record', async (t) => {
  const invalid = [
    null, [], 'memo', 42, { t: 'theorem/1' },
    memo({ t: 'other/1' }), memo({ extra: true }),
    memo({ n: 1 }), memo({ n: '' }), memo({ n: '   ' }),
    memo({ n: 'a'.repeat(33) }), memo({ n: '\u00e9'.repeat(17) }),
    memo({ s: null }), memo({ s: 'A' }), memo({ s: 'A'.repeat(11) }),
    memo({ s: 'BAD!' }), memo({ s: 'AB CD' }), memo({ s: '\u00e9A' }),
    memo({ x: false }), memo({ x: 'short' }), memo({ x: '    12345678901    ' }),
    memo({ x: 'a'.repeat(281) }), memo({ x: '\u00e9'.repeat(141) }),
  ];
  for (const value of invalid) {
    await t.test(JSON.stringify(value), async () => {
      const conn = connection(new Map([['invalid', transaction(value)]]));
      const market = await readMarket(conn);
      assert.deepEqual(market.coins, []);
      assert.deepEqual(market.known, {});
      assert.deepEqual(market.pending, {});
      assert.deepEqual(conn.calls.accounts, []);
    });
  }
});

test('accepts UTF-8 byte boundaries and alphanumeric ticker boundaries', async () => {
  for (const symbol of ['a1', 'Ab12345678']) {
    const value = memo({ n: '\u00e9'.repeat(16), s: symbol, x: '\u00e9'.repeat(140) });
    const market = await readMarket(connection(new Map([['valid', transaction(value)]])));
    assert.equal(market.known[mint].name, value.n);
    assert.equal(market.known[mint].symbol, symbol);
    assert.equal(market.known[mint].statement, value.x);
  }
});

test('a newer spoofed memo cannot hide the real memo for an existing mint', async () => {
  const conn = connection(new Map([
    ['attacker', transaction(memo({ n: 'Forged theorem', s: 'FAKE' }), attacker)],
    ['creator', transaction(memo())],
  ]));
  const market = await readMarket(conn);
  assert.equal(market.coins.length, 1);
  assert.equal(market.known[mint].name, 'Real theorem');
  assert.equal(market.known[mint].creator, creator.toBase58());
  assert.deepEqual(market.pending, {});
});

test('an attacker alone cannot introduce a coin or overwrite a known launch', async () => {
  const txs = new Map([['attacker', transaction(memo({ n: 'Forged theorem' }), attacker)]]);
  assert.deepEqual((await readMarket(connection(txs))).coins, []);
  const prev = await readMarket(connection(new Map([['creator', transaction(memo())]])));
  const market = await readMarket(connection(txs), prev);
  assert.deepEqual(market.known, prev.known);
  assert.deepEqual(market.pending, {});
});

test('pending creator candidates survive a later attacker memo and retry when the curve appears', async () => {
  const prev = await readMarket(connection(new Map([['creator', transaction(memo())]]), new Map()));
  assert.equal(Object.values(prev.pending).length, 1);
  const waiting = await readMarket(connection(new Map([
    ['attacker', transaction(memo({ n: 'Forged theorem' }), attacker)],
  ]), new Map()), prev);
  assert.equal(Object.values(waiting.pending).length, 2);
  const market = await readMarket(connection(new Map()), waiting);
  assert.equal(market.known[mint].name, 'Real theorem');
  assert.deepEqual(market.pending, {});
  assert.equal(Object.values(waiting.pending).length, 2, 'does not mutate previous state');
});

test('missing curves keep recent candidates but expire old candidates', async () => {
  const conn = connection(new Map([
    ['recent', transaction(memo())],
    ['expired', transaction(memo({ m: key(4).toBase58() }), creator, Math.floor(Date.now() / 1000) - 3601)],
  ]), new Map());
  const market = await readMarket(conn);
  assert.deepEqual(market.coins, []);
  assert.deepEqual(Object.values(market.pending).map((f) => f.memo.m), [mint]);
});

test('null parsed transactions retain the previous cursor and are retried', async () => {
  const prev = await readMarket(connection(new Map([['previous', transaction(null)]])));
  const txs = new Map([
    ['newest', transaction(memo())],
    ['delayed', null],
  ]);
  const partial = await readMarket(connection(txs), prev);
  assert.equal(partial.newest, 'previous');
  assert.equal(partial.coins.length, 1);
  txs.set('delayed', transaction(memo({ m: key(4).toBase58() })));
  const conn = connection(txs, new Map([[mint, curve], [key(4).toBase58(), curve]]));
  const complete = await readMarket(conn, partial);
  assert.equal(conn.calls.signatures[0].until, 'previous');
  assert.equal(complete.newest, 'newest');
  assert.equal(complete.coins.length, 2);
  assert.equal((await readMarket(connection(new Map([['delayed', null]])))).newest, undefined);
});

test('failed transactions and missing payers are ignored', async () => {
  const failed = transaction(memo());
  failed.meta.err = { InstructionError: [0, 'Custom'] };
  const missingPayer = transaction(memo());
  missingPayer.transaction.message.accountKeys = [];
  const market = await readMarket(connection(new Map([['failed', failed], ['missing-payer', missingPayer]])));
  assert.deepEqual(market.coins, []);
  assert.deepEqual(market.pending, {});
});
