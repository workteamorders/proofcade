require('./register.cjs');
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Keypair, PublicKey, SystemProgram, TransactionInstruction } = require('@solana/web3.js');
const sdk = { ...require('@pump-fun/pump-sdk') };
require.cache[require.resolve('@pump-fun/pump-sdk')].exports = sdk;
const pump = require('../lib/sol/pump.ts');
const { launch } = require('../lib/sol/launch.ts');
const { SubmittedTransactionError } = require('../lib/sol/errors.ts');

afterEach(() => mock.restoreAll());

function fixture({ combined = true } = {}) {
  const sends = [];
  const input = { name: 'Test', symbol: 'TEST', statement: 'A theorem', devBuy: new pump.BN(1), mint: Keypair.generate(), slippagePct: 1 };
  const ix = new TransactionInstruction({ programId: SystemProgram.programId, keys: [], data: Buffer.alloc(0) });
  mock.method(sdk, 'getBuyTokenAmountFromSolAmount', () => new pump.BN(1));
  mock.method(pump, 'online', () => ({
    fetchGlobal: async () => ({ createV2Enabled: true }),
    fetchFeeConfig: async () => null,
    fetchBuyState: async () => ({ bondingCurve: { complete: false } }),
  }));
  mock.method(pump.PUMP_SDK, 'createV2Instruction', async () => ix);
  mock.method(pump.PUMP_SDK, 'createV2AndBuyInstructions', async () => combined ? [ix] : [
    new TransactionInstruction({ programId: SystemProgram.programId, keys: [], data: Buffer.alloc(1400) }),
  ]);
  mock.method(pump.PUMP_SDK, 'buyInstructions', async () => [ix]);
  const conn = {
    getGenesisHash: async () => 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
    getLatestBlockhash: async () => ({ blockhash: PublicKey.default.toBase58(), lastValidBlockHeight: 100 }),
    simulateTransaction: async () => ({ value: { err: null } }),
    getSignatureStatuses: async () => { throw new Error('RPC unavailable'); },
    getBlockHeight: async () => 101,
    getAccountInfo: async () => ({}),
  };
  const wallet = {
    publicKey: Keypair.generate().publicKey,
    sendTransaction: async () => { const sig = `sig-${sends.length + 1}`; sends.push(sig); return sig; },
  };
  return { conn, wallet, input, sends };
}

const confirmed = { err: null, confirmationStatus: 'confirmed' };
const unknown = (e) => e instanceof SubmittedTransactionError && e.status === 'unknown';

for (const stage of ['marker', 'create', 'buy']) {
  test(`${stage}: unknown submission is retained, retry confirms without resending`, async () => {
    const f = fixture();
    const state = stage === 'marker' ? {} : stage === 'create' ? { marker: 'prior-marker' } : { marker: 'prior-marker', created: 'prior-create' };
    const step = (_label, sig) => {
      if (sig) assert.equal(state.pending.sig, sig);
    };
    await assert.rejects(launch(f.conn, f.wallet, f.input, step, state), unknown);
    assert.deepEqual(state.pending, { stage, sig: 'sig-1', lastValidBlockHeight: 100, includesBuy: stage === 'create' });
    assert.equal(state.bought, undefined);
    const pending = state.pending;
    await assert.rejects(launch(f.conn, f.wallet, f.input, step, state), unknown);
    assert.equal(state.pending, pending);
    assert.equal(f.sends.length, 1);

    f.conn.getSignatureStatuses = async () => ({ value: [confirmed] });
    await launch(f.conn, f.wallet, f.input, step, state);
    assert.equal(state.pending, undefined);
    assert.ok(state.marker);
    assert.ok(state.created);
    assert.ok(state.bought);
    assert.equal(f.sends.length, stage === 'marker' ? 2 : 1);
    if (stage === 'create') assert.equal(state.bought, state.created);
    if (stage === 'buy') assert.equal(state.bought, 'sig-1');
  });
}

test('confirmed create without bundled buy proceeds to exactly one separate buy', async () => {
  const f = fixture({ combined: false });
  const state = { marker: 'prior-marker' };
  await assert.rejects(launch(f.conn, f.wallet, f.input, () => {}, state), unknown);
  assert.equal(state.pending.stage, 'create');
  assert.equal(state.pending.includesBuy, false);
  f.conn.getSignatureStatuses = async () => ({ value: [confirmed] });
  await launch(f.conn, f.wallet, f.input, () => {}, state);
  assert.equal(state.created, 'sig-1');
  assert.equal(state.bought, 'sig-2');
  assert.equal(f.sends.length, 2);
  await launch(f.conn, f.wallet, f.input, () => {}, state);
  assert.equal(f.sends.length, 2);
});

for (const status of ['failed', 'expired']) {
  test(`${status}: pending clears only after reconciliation, next invocation can resend`, async () => {
    const f = fixture();
    const pending = { stage: 'buy', sig: 'old-buy', lastValidBlockHeight: 100, includesBuy: false };
    const state = { marker: 'prior-marker', created: 'prior-create', pending };
    let reads = 0;
    f.conn.getSignatureStatuses = async (_sigs, opts) => {
      assert.equal(opts.searchTransactionHistory, true);
      reads++;
      return { value: [status === 'failed' ? { ...confirmed, err: 'failure' } : null] };
    };
    await assert.rejects(launch(f.conn, f.wallet, f.input, () => {}, state), (e) => e instanceof SubmittedTransactionError && e.status === status);
    assert.equal(reads, status === 'expired' ? 2 : 1);
    assert.equal(state.pending, undefined);
    assert.equal(state.bought, undefined);
    assert.equal(f.sends.length, 0);
    f.conn.getSignatureStatuses = async () => ({ value: [confirmed] });
    await launch(f.conn, f.wallet, f.input, () => {}, state);
    assert.equal(state.bought, 'sig-1');
    assert.equal(f.sends.length, 1);
  });
}

test('expiry race confirms a pending buy instead of buying twice', async () => {
  const f = fixture();
  const state = { marker: 'prior-marker', created: 'prior-create', pending: { stage: 'buy', sig: 'old-buy', lastValidBlockHeight: 100, includesBuy: false } };
  let reads = 0;
  f.conn.getSignatureStatuses = async () => ({ value: [++reads === 1 ? null : confirmed] });
  await launch(f.conn, f.wallet, f.input, () => {}, state);
  assert.equal(state.bought, 'old-buy');
  assert.equal(state.pending, undefined);
  assert.equal(f.sends.length, 0);
});

test('unavailable final history preserves pending buy and prevents resend', async () => {
  const f = fixture();
  const pending = { stage: 'buy', sig: 'old-buy', lastValidBlockHeight: 100, includesBuy: false };
  const state = { marker: 'prior-marker', created: 'prior-create', pending };
  let reads = 0;
  f.conn.getSignatureStatuses = async () => {
    if (++reads === 2) throw new Error('History unavailable');
    return { value: [null] };
  };
  await assert.rejects(launch(f.conn, f.wallet, f.input, () => {}, state), unknown);
  assert.equal(state.pending, pending);
  assert.equal(state.bought, undefined);
  assert.equal(f.sends.length, 0);
});

test('concurrent invocations sharing state cannot send twice', async () => {
  const f = fixture();
  const state = { marker: 'prior-marker', created: 'prior-create' };
  let release;
  f.wallet.sendTransaction = async () => new Promise((resolve) => { release = () => { f.sends.push('sig-1'); resolve('sig-1'); }; });
  const first = launch(f.conn, f.wallet, f.input, () => {}, state);
  await assert.rejects(launch(f.conn, f.wallet, f.input, () => {}, state), /already in progress/);
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  const rejected = assert.rejects(first, unknown);
  release();
  await rejected;
  assert.equal(f.sends.length, 1);
  assert.equal(state.pending.sig, 'sig-1');
});

test('a partial launch cannot resume with a different creator wallet', async () => {
  const f = fixture();
  const state = {};
  await assert.rejects(launch(f.conn, f.wallet, f.input, () => {}, state), unknown);
  const original = f.wallet.publicKey;
  f.wallet.publicKey = Keypair.generate().publicKey;
  await assert.rejects(launch(f.conn, f.wallet, f.input, () => {}, state), /Reconnect the wallet that started/);
  assert.equal(state.wallet, original.toBase58());
  assert.equal(f.sends.length, 1);
  assert.equal(state.pending.sig, 'sig-1');
});
