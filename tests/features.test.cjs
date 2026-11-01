require('./register.cjs');
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const path = require.resolve('../lib/features.ts');
const load = () => { delete require.cache[path]; return require(path); };
afterEach(() => { delete process.env.NEXT_PUBLIC_FEATURE_RIGOR; delete process.env.NEXT_PUBLIC_FEATURE_VERIFY; delete require.cache[path]; });

test('rigor and verify are off unless switched on', () => {
  const f = load();
  assert.deepEqual([f.RIGOR_ON, f.VERIFY_ON], [false, false]);
});

test('only the exact value 1 switches a feature on', () => {
  process.env.NEXT_PUBLIC_FEATURE_RIGOR = 'true';
  process.env.NEXT_PUBLIC_FEATURE_VERIFY = '0';
  assert.deepEqual([load().RIGOR_ON, load().VERIFY_ON], [false, false]);
  process.env.NEXT_PUBLIC_FEATURE_RIGOR = '1';
  process.env.NEXT_PUBLIC_FEATURE_VERIFY = '1';
  assert.deepEqual([load().RIGOR_ON, load().VERIFY_ON], [true, true]);
});
