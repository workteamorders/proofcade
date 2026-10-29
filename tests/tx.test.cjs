require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PublicKey } = require('@solana/web3.js');
const { confirm, run } = require('../lib/sol/tx.ts');
const { SubmittedTransactionError, txError } = require('../lib/sol/errors.ts');

const sig = 'submitted-signature';
const height = 100;
const confirmed = { err: null, confirmationStatus: 'confirmed' };

function expectSubmitted(status) {
  return (e) => {
    assert.ok(e instanceof SubmittedTransactionError);
    assert.equal(e.sig, sig);
    assert.equal(e.lastValidBlockHeight, height);
    assert.equal(e.status, status);
    return true;
  };
}

function fixture() {
  let sends = 0;
  const conn = {
    getGenesisHash: async () => 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
    getLatestBlockhash: async () => ({ blockhash: PublicKey.default.toBase58(), lastValidBlockHeight: height }),
    simulateTransaction: async () => ({ value: { err: null } }),
    getSignatureStatuses: async () => ({ value: [confirmed] }),
    getBlockHeight: async () => height,
  };
  const wallet = {
    publicKey: PublicKey.default,
    sendTransaction: async () => { sends++; return sig; },
  };
  return { conn, wallet, sends: () => sends };
}

test('run preserves submission details on confirmation RPC failure', async () => {
  const f = fixture();
  const rpcError = new Error('RPC unavailable: block height exceeded');
  const steps = [];
  f.conn.getSignatureStatuses = async () => {
    assert.deepEqual(steps.at(-1).slice(1), [sig, height]);
    throw rpcError;
  };
  await assert.rejects(run(f.conn, f.wallet, [], { units: 1000, step: (...args) => steps.push(args) }), (e) => {
    expectSubmitted('unknown')(e);
    assert.equal(e.cause, rpcError);
    assert.match(txError(e), /outcome is still unknown/);
    assert.doesNotMatch(txError(e), /Try again/);
    return true;
  });
  assert.equal(f.sends(), 1);
});

test('run retains the signature even when the submitted step callback throws', async () => {
  const f = fixture();
  await assert.rejects(run(f.conn, f.wallet, [], {
    units: 1000,
    step: (_label, submitted) => { if (submitted) throw new Error('UI callback failed'); },
  }), expectSubmitted('unknown'));
  assert.equal(f.sends(), 1);
});

test('wallet rejection before submission is not a SubmittedTransactionError', async () => {
  const f = fixture();
  const rejection = new Error('User rejected the request');
  f.wallet.sendTransaction = async () => { throw rejection; };
  await assert.rejects(run(f.conn, f.wallet, [], { units: 1000 }), (e) => e === rejection);
});

test('wrong-cluster RPC is rejected before simulation or wallet signing', async () => {
  const f = fixture();
  f.conn.getGenesisHash = async () => '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
  f.conn.simulateTransaction = async () => { assert.fail('must not simulate on the wrong cluster'); };
  await assert.rejects(run(f.conn, f.wallet, [], { units: 1000 }), /RPC network does not match/);
  assert.equal(f.sends(), 0);
});

test('confirmation through a wrong-cluster RPC leaves the submitted outcome unknown', async () => {
  const f = fixture();
  f.conn.getGenesisHash = async () => 'wrong-network';
  f.conn.getSignatureStatuses = async () => { assert.fail('must not reconcile against the wrong cluster'); };
  await assert.rejects(confirm(f.conn, sig, height), expectSubmitted('unknown'));
});

test('confirmation timeout retains signature and unknown status', async () => {
  await assert.rejects(confirm(fixture().conn, sig, height, 0), expectSubmitted('unknown'));
});

test('confirmed on-chain errors are failed, not unknown or expired', async () => {
  const { conn } = fixture();
  conn.getSignatureStatuses = async (_sigs, opts) => {
    assert.equal(opts.searchTransactionHistory, true);
    return { value: [{ ...confirmed, err: { InstructionError: [0, 'Custom'] } }] };
  };
  await assert.rejects(confirm(conn, sig, height), expectSubmitted('failed'));
});

test('expiry uses finalized height and a final history lookup', async () => {
  const { conn } = fixture();
  const calls = [];
  conn.getSignatureStatuses = async (sigs, opts) => {
    assert.deepEqual(sigs, [sig]);
    assert.equal(opts.searchTransactionHistory, true);
    calls.push('history');
    return { value: [null] };
  };
  conn.getBlockHeight = async (commitment) => {
    assert.equal(commitment, 'finalized');
    calls.push('height');
    return height + 1;
  };
  await assert.rejects(confirm(conn, sig, height), expectSubmitted('expired'));
  assert.deepEqual(calls, ['history', 'height', 'history']);
});

test('a transaction appearing during expiry check is confirmed, not expired', async () => {
  const { conn } = fixture();
  let reads = 0;
  conn.getSignatureStatuses = async () => ({ value: [++reads === 1 ? null : confirmed] });
  conn.getBlockHeight = async () => height + 1;
  await confirm(conn, sig, height);
  assert.equal(reads, 2);
});

test('a failure appearing during expiry check is failed, not expired', async () => {
  const { conn } = fixture();
  let reads = 0;
  conn.getSignatureStatuses = async () => ({ value: [++reads === 1 ? null : { ...confirmed, err: 'failure' }] });
  conn.getBlockHeight = async () => height + 1;
  await assert.rejects(confirm(conn, sig, height), expectSubmitted('failed'));
  assert.equal(reads, 2);
});

test('failed final history lookup leaves outcome unknown', async () => {
  const { conn } = fixture();
  let reads = 0;
  conn.getSignatureStatuses = async () => {
    if (++reads === 2) throw new Error('history unavailable');
    return { value: [null] };
  };
  conn.getBlockHeight = async () => height + 1;
  await assert.rejects(confirm(conn, sig, height), expectSubmitted('unknown'));
});

for (const err of [null, 'processed failure']) {
  test(`processed status (${err}) is not safe to clear, even past expiry`, async () => {
    const { conn } = fixture();
    conn.getSignatureStatuses = async () => ({ value: [{ err, confirmationStatus: 'processed' }] });
    conn.getBlockHeight = async () => height + 1;
    await assert.rejects(confirm(conn, sig, height), expectSubmitted('unknown'));
  });
}
