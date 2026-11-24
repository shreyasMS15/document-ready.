import * as pdfjs from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = worker;
const assets = new URL('pdfjs/', document.baseURI);

export async function openPdf(bytes) {
  return pdfjs.getDocument({
    data: bytes.slice(),
    isEvalSupported: false,
    enableXfa: false,
    cMapUrl: new URL('cmaps/', assets).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('standard_fonts/', assets).href,
    wasmUrl: new URL('wasm/', assets).href,
  }).promise;
}

function getCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = 'white';
  context.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, context };
}

async function pack(canvas, width, height, quality) {
  try {
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not render this page.')), 'image/jpeg', quality),
    );
    return { blob, bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function renderPage(pdf, index, edge, quality) {
  const page = await pdf.getPage(index + 1);
  const natural = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: edge / Math.max(natural.width, natural.height) });
  const { canvas, context } = getCanvas(viewport.width, viewport.height);
  try {
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return await pack(canvas, natural.width, natural.height, quality);
  } finally {
    page.cleanup();
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function renderPhoto(file, edge, quality) {
  const image = await createImageBitmap(file);
  try {
    if (!image.width || !image.height) throw new Error('This image has no pixels.');
    const dimensions = Math.min(1, edge / Math.max(image.width, image.height));
    const { canvas, context } = getCanvas(image.width * dimensions, image.height * dimensions);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await pack(canvas, image.width, image.height, quality);
  } finally {
    image.close();
  }
}
