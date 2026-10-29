require('./register.cjs');
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const keys = ['NEXT_PUBLIC_SOLANA_CLUSTER', 'SOLANA_RPC_URL', 'NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_SOLANA_RPC_URL'];
const path = require.resolve('../next.config.ts');
let saved;
const load = () => { delete require.cache[path]; return require(path).default; };

beforeEach(() => {
  saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  keys.forEach((key) => delete process.env[key]);
});
afterEach(() => {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  delete require.cache[path];
});

test('configuration accepts defaults and complete Devnet deployment URLs', () => {
  assert.equal(load().reactStrictMode, true);
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER = 'devnet';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://theorem-pi.vercel.app';
  process.env.SOLANA_RPC_URL = 'https://provider.example/?api-key=test';
  assert.equal(load().reactStrictMode, true);
});

test('configuration refuses unsupported cluster names instead of silently using Devnet', () => {
  for (const cluster of ['testnet', 'mainnet', 'typo']) {
    process.env.NEXT_PUBLIC_SOLANA_CLUSTER = cluster;
    assert.throws(load, /Solana testnet is not supported/);
  }
});

test('configuration rejects invalid provider URLs without printing their values', () => {
  for (const key of ['SOLANA_RPC_URL', 'NEXT_PUBLIC_SOLANA_RPC_URL']) {
    for (const value of ['secret-api-key-only', 'wss://provider.example/secret', 'file:///private/secret']) {
      process.env[key] = value;
      assert.throws(load, (e) => e.message.includes(key) && !e.message.includes(value));
    }
    delete process.env[key];
  }
});

test('site metadata configuration must be an origin without credentials, path or query', () => {
  for (const url of ['not-a-url', 'https://user:secret@example.com', 'https://example.com/path', 'https://example.com/?key=secret', 'https://example.com/#section']) {
    process.env.NEXT_PUBLIC_SITE_URL = url;
    assert.throws(load, /containing only the site origin/);
  }
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  assert.equal(load().reactStrictMode, true);
});
