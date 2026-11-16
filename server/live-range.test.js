import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { serve, parseRange } from './live.js';

test('parseRange understands a-b, a-, -n and rejects the rest', () => {
  assert.deepEqual(parseRange('bytes=0-9', 100), { start: 0, end: 9 });
  assert.deepEqual(parseRange('bytes=90-', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=50-500', 100), { start: 50, end: 99 });
  assert.equal(parseRange('bytes=100-', 100), 'bad');
  assert.equal(parseRange('bytes=9-2', 100), 'bad');
  assert.equal(parseRange(undefined, 100), null);
  assert.equal(parseRange('items=0-1', 100), null);
});

function request(p, rel, range) {
  return new Promise(resolve => {
    const out = new PassThrough(), chunks = [];
    out.on('data', c => chunks.push(c));
    const res = Object.assign(out, { writeHead(code, headers) { this.code = code; this.headers = headers; }, destroy() { } });
    out.on('end', () => resolve({ code: res.code, headers: res.headers, body: Buffer.concat(chunks) }));
    serve({ headers: range ? { range } : {} }, res, p, rel);
  });
}

test('live serve answers Range with 206, whole file with 200, bad range with 416', async () => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '.', 'live-range-'));
  try {
    fs.writeFileSync(path.join(dir, 'clip.mp4'), Buffer.from('0123456789'));
    const p = { id: 'x', path: dir };
    let r = await request(p, 'clip.mp4', 'bytes=2-5');
    assert.equal(r.code, 206); assert.equal(r.headers['Content-Range'], 'bytes 2-5/10'); assert.equal(r.body.toString(), '2345');
    r = await request(p, 'clip.mp4');
    assert.equal(r.code, 200); assert.equal(r.headers['Accept-Ranges'], 'bytes'); assert.equal(r.headers['Content-Length'], 10); assert.equal(r.body.length, 10);
    r = await request(p, 'clip.mp4', 'bytes=-3');
    assert.equal(r.code, 206); assert.equal(r.body.toString(), '789');
    r = await request(p, 'clip.mp4', 'bytes=50-');
    assert.equal(r.code, 416);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
