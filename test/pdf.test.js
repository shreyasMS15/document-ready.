import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { assemble, fitLimit, parseLimit, PROFILES } from '../src/pdf.js';

test('accepts decimal kilobytes without exceeding the selected byte limit', () => {
  assert.equal(parseLimit('2000'), 2_000_000);
  for (const invalid of ['', '0', '1.5', '-1', '50001', 'Infinity']) {
    assert.throws(() => parseLimit(invalid), /whole-number/);
  }
});

test('assembles selected pages in order, including repeats from one input', async () => {
  const original = await PDFDocument.create();
  original.addPage([300, 400]);
  original.addPage([500, 600]);
  const source = { kind: 'pdf', bytes: await original.save() };
  const output = await assemble([1, 0, 1].map((index) => ({ source, index })), () => assert.fail());
  const pdf = await PDFDocument.load(output);
  assert.deepEqual(pdf.getPages().map((page) => page.getWidth()), [500, 300, 500]);
});

test('stops at the first profile that meets the limit exactly', async () => {
  const sizes = [2000, 1000, 500];
  let builds = 0;
  const result = await fitLimit(1000, () => new Uint8Array(sizes[builds++]));
  assert.equal(builds, 2);
  assert.equal(result.bytes.length, 1000);
  assert.equal(result.meetsLimit, true);
});

test('reports an unmet limit and returns the smallest measured result', async () => {
  assert.equal(PROFILES.length, 5);
  const sizes = [2000, 1000, 900, 950, 1100];
  const result = await fitLimit(800, () => new Uint8Array(sizes.shift()));
  assert.equal(result.bytes.length, 900);
  assert.equal(result.meetsLimit, false);
});
