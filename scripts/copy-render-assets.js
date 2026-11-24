import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const source = new URL('node_modules/pdfjs-dist/', root);
const target = new URL('public/pdfjs/', root);
await mkdir(target, { recursive: true });
for (const name of ['cmaps', 'standard_fonts', 'wasm', 'LICENSE']) {
  await cp(fileURLToPath(new URL(name, source)), fileURLToPath(new URL(name, target)), { recursive: true });
}

const licenses = new URL('public/licenses/', root);
await mkdir(licenses, { recursive: true });
for (const [name, path] of Object.entries({
  'document-ready': 'LICENSE',
  'pdf-lib': 'node_modules/pdf-lib/LICENSE.md',
  'pdf-lib-standard-fonts': 'node_modules/@pdf-lib/standard-fonts/LICENSE.md',
  'pdf-lib-upng': 'node_modules/@pdf-lib/upng/LICENSE',
  'pako': 'node_modules/pako/LICENSE',
  'tslib': 'node_modules/tslib/LICENSE.txt',
  'pdfjs': 'node_modules/pdfjs-dist/LICENSE',
})) {
  await cp(fileURLToPath(new URL(path, root)), fileURLToPath(new URL(`${name}.txt`, licenses)));
}
