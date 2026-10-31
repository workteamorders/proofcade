require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const config = require('../lib/sol/config.ts');

test('the browser RPC URL keeps "devnet" so wallets sign for Devnet, never Mainnet', () => {
  global.window = { location: { origin: 'https://theorem-pi.vercel.app' } };
  try {
    const url = config.rpcEndpoint();
    assert.equal(url, 'https://theorem-pi.vercel.app/api/rpc?cluster=devnet');
    assert.equal(config.endpointCluster(url), 'devnet');
  } finally { delete global.window; }
});

test('endpointCluster follows the wallet adapter rules', () => {
  assert.equal(config.endpointCluster('https://api.mainnet-beta.solana.com'), 'mainnet-beta');
  assert.equal(config.endpointCluster('https://api.devnet.solana.com'), 'devnet');
  assert.equal(config.endpointCluster('https://x.app/api/rpc'), 'mainnet-beta');
  assert.equal(config.endpointCluster('http://localhost:8899'), 'localnet');
});
