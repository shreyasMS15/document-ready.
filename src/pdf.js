import { PDFDocument } from 'pdf-lib';

export const MAX_PAGES = 60;
export const MAX_INPUT_BYTES = 80_000_000;
export const PROFILES = [
  { edge: 1700, quality: 0.84 },
  { edge: 1400, quality: 0.72 },
  { edge: 1100, quality: 0.60 },
  { edge: 850, quality: 0.50 },
  { edge: 650, quality: 0.42 },
];

export function parseLimit(value) {
  const kb = Number(value);
  if (!Number.isInteger(kb) || kb < 1 || kb > 50_000) {
    throw new Error('Enter a whole-number limit from 1 to 50,000 KB.');
  }
  return kb * 1000;
}

export function describeSize(bytes) {
  if (bytes < 1000) return `${bytes} bytes`;
  return `${(bytes / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} KB`;
}

export async function assemble(entries, openPhoto) {
  const document = await PDFDocument.create();
  const sources = new Map();
  for (const entry of entries) {
    if (entry.source.kind === 'pdf') {
      if (!sources.has(entry.source)) {
        sources.set(entry.source, await PDFDocument.load(entry.source.bytes));
      }
      const [page] = await document.copyPages(sources.get(entry.source), [entry.index]);
      document.addPage(page);
    } else {
      const photo = await openPhoto(entry.source.file);
      await addJpeg(document, photo);
    }
  }
  return save(document);
}

export async function addJpeg(document, { bytes, width, height }) {
  const image = await document.embedJpg(bytes);
  const scale = Math.min(1, 842 / Math.max(width, height));
  const page = document.addPage([width * scale, height * scale]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
  });
}

export function save(document) {
  document.setTitle('Prepared documents');
  document.setCreator('Document Ready');
  return document.save({ useObjectStreams: true });
}

export async function fitLimit(limit, build) {
  let smallest;
  for (const profile of PROFILES) {
    const bytes = await build(profile);
    if (bytes.length <= limit) return { bytes, meetsLimit: true };
    if (!smallest || bytes.length < smallest.length) smallest = bytes;
  }
  return { bytes: smallest, meetsLimit: false };
}
