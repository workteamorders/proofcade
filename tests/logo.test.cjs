require('./register.cjs');
const Module = require('node:module');
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

/* a stand-in for @vercel/blob that keeps files in memory */
let store;
let putOpts;
const blobMock = {
  head: async (p) => { if (!store.has(p)) { const e = new Error('The requested blob does not exist'); e.name = 'BlobNotFoundError'; throw e; } return { url: `https://blob.test/${p}` }; },
  put: async (p, body, opts) => { putOpts = opts; if (store.has(p) && !opts.allowOverwrite) throw new Error('This blob already exists'); store.set(p, body); return { url: `https://blob.test/${p}` }; },
};
const realLoad = Module._load;
Module._load = function (request, ...rest) { return request === '@vercel/blob' ? blobMock : realLoad.call(this, request, ...rest); };

const logo = require('../lib/logo.ts');
const route = () => { const p = require.resolve('../app/api/logo/[mint]/route.ts'); delete require.cache[p]; return require(p); };

const MINT = '2gMeWrYoHFXx9HUwDbmhdkeeCRXvrRvtLfiNYHpW2jVa';
const png = (w, h, extra = 0) => {
  const b = new Uint8Array(33 + extra);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const v = new DataView(b.buffer); v.setUint32(16, w); v.setUint32(20, h);
  return b;
};
const put = (body, headers = {}) => new Request(`https://theorema.fun/api/logo/${MINT}`, { method: 'PUT', headers: { origin: 'https://theorema.fun', 'content-type': 'image/png', ...headers }, body });
const ctx = { params: Promise.resolve({ mint: MINT }) };

beforeEach(() => { store = new Map(); putOpts = undefined; process.env.BLOB_READ_WRITE_TOKEN = 'test'; process.env.NEXT_PUBLIC_SITE_URL = 'https://theorema.fun'; });
afterEach(() => { delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.NEXT_PUBLIC_SITE_URL; });

test('pngSize reads the header and refuses other bytes', () => {
  assert.deepEqual(logo.pngSize(png(256, 256)), { w: 256, h: 256 });
  assert.equal(logo.pngSize(new Uint8Array(40)), null);
  assert.equal(logo.pngSize(new Uint8Array([1, 2, 3])), null);
});

test('logoProblem accepts a 256 px square and rejects size, shape and type problems', () => {
  assert.equal(logo.logoProblem(png(256, 256)), null);
  assert.match(logo.logoProblem(png(256, 128)), /square/);
  assert.match(logo.logoProblem(png(32, 32)), /between/);
  assert.match(logo.logoProblem(png(1024, 1024)), /between/);
  assert.match(logo.logoProblem(png(256, 256, logo.LOGO_MAX_BYTES)), /under/);
  assert.match(logo.logoProblem(new Uint8Array(64)), /PNG/);
});

test('PUT stores a valid logo once, without overwrite, under the mint', async () => {
  const r = route();
  const res = await r.PUT(put(png(256, 256)), ctx);
  assert.equal(res.status, 201);
  assert.ok(store.has(`logos/${MINT}.png`));
  assert.deepEqual([putOpts.access, putOpts.addRandomSuffix, putOpts.allowOverwrite, putOpts.contentType], ['public', false, false, 'image/png']);
  assert.equal((await r.PUT(put(png(256, 256)), ctx)).status, 409);
});

test('PUT refuses a foreign origin, a wrong type, bad bytes and a bad mint', async () => {
  const r = route();
  assert.equal((await r.PUT(put(png(256, 256), { origin: 'https://evil.example' }), ctx)).status, 403);
  assert.equal((await r.PUT(put(png(256, 256), { 'content-type': 'image/jpeg' }), ctx)).status, 415);
  assert.equal((await r.PUT(put(new Uint8Array(100)), ctx)).status, 400);
  assert.equal((await r.PUT(put(png(256, 256)), { params: Promise.resolve({ mint: 'nope' }) })).status, 400);
  assert.equal(store.size, 0);
});

test('PUT refuses an oversized body even when the length header lies', async () => {
  const res = await route().PUT(put(png(256, 256, logo.LOGO_MAX_BYTES + 10)), ctx);
  assert.equal(res.status, 413);
  assert.equal(store.size, 0);
});

test('PUT says custom logos are off when no Blob store is connected', async () => {
  delete process.env.BLOB_READ_WRITE_TOKEN;
  assert.equal((await route().PUT(put(png(256, 256)), ctx)).status, 503);
});

test('PUT limits uploads from one address', async () => {
  const r = route();
  const codes = [];
  for (let i = 0; i < 12; i++) { store.clear(); codes.push((await r.PUT(put(png(256, 256), { 'x-forwarded-for': '9.9.9.9' }), ctx)).status); }
  assert.deepEqual(codes.slice(0, 10), Array(10).fill(201));
  assert.equal(codes[10], 429);
});

test('GET redirects to the stored image, and answers 404 when there is none', async () => {
  const r = route();
  const miss = await r.GET(new Request('https://x.test'), ctx);
  assert.equal(miss.status, 404);
  store.set(`logos/${MINT}.png`, new Uint8Array(1));
  const hit = await r.GET(new Request('https://x.test'), ctx);
  assert.equal(hit.status, 302);
  assert.equal(hit.headers.get('location'), `https://blob.test/logos/${MINT}.png`);
});

test('the metadata route points the image at the logo only when the launch says it has one', async () => {
  const meta = require('../app/api/meta/[mint]/route.ts');
  const get = async (q) => (await meta.GET(new Request(`https://theorema.fun/api/meta/${MINT}${q}`), ctx)).json();
  assert.equal((await get('?n=A&s=AB')).image, `https://theorema.fun/api/sprite/${MINT}`);
  assert.equal((await get('?n=A&s=AB&l=1')).image, `https://theorema.fun/api/logo/${MINT}`);
});
