import { PDFDocument } from 'pdf-lib';
import { addJpeg, assemble, describeSize, fitLimit, MAX_INPUT_BYTES, MAX_PAGES, parseLimit, save } from './pdf.js';
import { openPdf, renderPage, renderPhoto } from './render.js';
import './style.css';

const get = (id) => document.getElementById(id);
const files = get('files');
const list = get('page-list');
const preview = get('preview');
const result = get('result');
const prepare = get('prepare');
const limitInput = get('limit');
let pages = [];
let busy = false;
let downloadUrl;
let previewUrl;
const history = [];

function announce(message) {
  get('status').textContent = message;
}

function clearResult() {
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = undefined;
  result.replaceChildren();
  result.hidden = true;
}

function makeButton(label, action, className = 'text-button') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}

function draw() {
  list.replaceChildren();
  pages.forEach((entry, index) => {
    const item = document.createElement('li');
    item.className = 'page';
    const view = makeButton('View', () => showPreview(index), 'preview-button');
    view.setAttribute('aria-label', `Preview page ${index + 1}`);
    const label = document.createElement('span');
    label.className = 'page-name';
    label.textContent = `${index + 1}. ${entry.source.file.name}${entry.source.kind === 'pdf' ? ` · p. ${entry.index + 1}` : ''}`;
    const controls = document.createElement('div');
    controls.className = 'page-controls';
    for (const [symbol, description, action, disabled] of [
      ['↑', 'Move up', () => move(index, -1), index === 0],
      ['↓', 'Move down', () => move(index, 1), index === pages.length - 1],
      ['×', 'Remove', () => remove(index), false],
    ]) {
      const button = makeButton(symbol, action);
      button.disabled = busy || disabled;
      button.setAttribute('aria-label', `${description} page ${index + 1}`);
      controls.append(button);
    }
    view.disabled = busy;
    item.append(view, label, controls);
    list.append(item);
  });
  get('page-count').textContent = `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`;
  get('page-actions').hidden = !history.length;
  get('undo').disabled = busy || !history.length;
  get('clear').disabled = busy || !pages.length;
  get('browse').disabled = busy;
  prepare.disabled = busy || !pages.length;
}

function saveHistory() {
  history.push(pages);
  if (history.length > 10) history.shift();
  while (history.length > 1) {
    const originals = new Set(history.flatMap((snapshot) => snapshot.map((entry) => entry.source)));
    const bytes = [...originals].reduce((sum, source) => sum + source.file.size, 0);
    if (bytes <= MAX_INPUT_BYTES) break;
    history.shift();
  }
  clearResult();
}

function move(index, delta) {
  saveHistory();
  pages = [...pages];
  [pages[index], pages[index + delta]] = [pages[index + delta], pages[index]];
  draw();
  const row = list.children[index + delta];
  const moveButton = row.querySelectorAll('.page-controls button')[delta < 0 ? 0 : 1];
  (moveButton.disabled ? row.querySelector('.preview-button') : moveButton).focus();
  announce(`Moved page ${index + 1} to position ${index + delta + 1}.`);
}

function remove(index) {
  saveHistory();
  pages = pages.filter((_, i) => i !== index);
  draw();
  (list.children[Math.min(index, pages.length - 1)]?.querySelector('.preview-button') ?? get('undo')).focus();
  announce(`Removed page ${index + 1}.`);
}

async function importFiles(selected) {
  if (busy || !selected.length) return;
  busy = true;
  draw();
  announce('Reading files…');
  const entries = [];
  const errors = [];
  let total = [...new Set(pages.map((entry) => entry.source))].reduce((sum, source) => sum + source.file.size, 0);
  try {
    for (const file of selected) {
      try {
        if (total + file.size > MAX_INPUT_BYTES) throw new Error('the combined size limit is 80 MB');
        let incoming;
        if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const pdf = await PDFDocument.load(bytes);
          const count = pdf.getPageCount();
          if (!count) throw new Error('the PDF has no pages');
          if (pages.length + entries.length + count > MAX_PAGES) throw new Error('the page limit is 60');
          const source = { kind: 'pdf', bytes, file };
          incoming = Array.from({ length: count }, (_, index) => ({ source, index }));
        } else if (/\.(jpe?g|png|webp)$/i.test(file.name) || /^image\/(jpeg|png|webp)$/.test(file.type)) {
          if (pages.length + entries.length >= MAX_PAGES) throw new Error('the page limit is 60');
          const bitmap = await createImageBitmap(file);
          bitmap.close();
          incoming = [{ source: { kind: 'photo', file } }];
        } else {
          throw new Error('file type not supported');
        }
        total += file.size;
        entries.push(...incoming);
      } catch (error) {
        const explanation = /encrypted|password/i.test(error.message) ? 'password-protected PDF' : error.message;
        errors.push(`${file.name}: ${explanation}`);
      }
    }
    if (entries.length) {
      saveHistory();
      pages = [...pages, ...entries];
    }
    announce([`Added ${entries.length} ${entries.length === 1 ? 'page' : 'pages'}.`, ...errors].join(' '));
  } finally {
    busy = false;
    files.value = '';
    draw();
  }
}

async function showPreview(index, exported) {
  if (preview.open) return;
  const content = get('preview-content');
  get('preview-title').textContent = exported ? 'Export preview' : `Page ${index + 1} preview`;
  content.textContent = 'Rendering preview…';
  preview.showModal();
  let pdf;
  let closed = false;
  const revision = Number(preview.dataset.revision || 0) + 1;
  preview.dataset.revision = revision;
  preview.addEventListener('close', () => {
    closed = true;
    pdf?.destroy().catch(() => {});
  }, { once: true });
  try {
    const entry = pages[index];
    if (exported || entry.source.kind === 'pdf') pdf = await openPdf(exported ?? entry.source.bytes);
    if (!preview.open || Number(preview.dataset.revision) !== revision) return;
    let currentPage = exported ? 0 : (entry.index ?? 0);
    const image = document.createElement('img');
    const nav = document.createElement('div');
    nav.className = 'page-actions';
    let previous;
    let next;
    const count = document.createElement('span');

    async function render() {
      if (previous) previous.disabled = true;
      if (next) next.disabled = true;
      const rendered = pdf
        ? await renderPage(pdf, currentPage, 1250, 0.86)
        : await renderPhoto(entry.source.file, 1250, 0.86);
      if (!preview.open || Number(preview.dataset.revision) !== revision) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(rendered.blob);
      image.alt = `Preview of page ${exported ? currentPage + 1 : index + 1}`;
      image.src = previewUrl;
      content.replaceChildren(image);
      if (exported && pdf.numPages > 1) {
        count.textContent = `Page ${currentPage + 1} of ${pdf.numPages}`;
        nav.replaceChildren(previous, count, next);
        content.append(nav);
        previous.disabled = currentPage === 0;
        next.disabled = currentPage === pdf.numPages - 1;
      }
    }

    function changePage(delta) {
      currentPage += delta;
      render().catch(() => { content.textContent = 'Could not preview this page.'; });
    }

    previous = makeButton('Previous', () => changePage(-1));
    next = makeButton('Next', () => changePage(1));
    await render();
  } catch {
    if (preview.open && Number(preview.dataset.revision) === revision) content.textContent = 'Could not preview this page.';
  } finally {
    if (closed && pdf) await pdf.destroy().catch(() => {});
  }
}

async function buildCompressed(original, limit) {
  const pdf = await openPdf(original);
  try {
    return await fitLimit(limit, async ({ edge, quality }) => {
      announce(`Checking a compressed version at ${edge} px per page…`);
      const output = await PDFDocument.create();
      for (let page = 0; page < pdf.numPages; page++) {
        await addJpeg(output, await renderPage(pdf, page, edge, quality));
      }
      return save(output);
    });
  } finally {
    await pdf.destroy();
  }
}

async function prepareExport() {
  if (busy || !pages.length) return;
  clearResult();
  let limit;
  try {
    limit = parseLimit(limitInput.value);
  } catch (error) {
    announce(error.message);
    limitInput.focus();
    return;
  }
  const mode = document.querySelector('[name="mode"]:checked').value;
  busy = true;
  const settings = [limitInput, ...document.querySelectorAll('[name="mode"]')];
  settings.forEach((element) => { element.disabled = true; });
  draw();
  announce('Assembling your PDF…');
  try {
    const original = await assemble(pages, (file) => renderPhoto(file, 2600, 0.93));
    let bytes = original;
    let meetsLimit = bytes.length <= limit;
    let flattened = false;
    if (!meetsLimit && mode === 'compress') {
      const attempt = await buildCompressed(original, limit);
      if (attempt.bytes.length < original.length) {
        ({ bytes, meetsLimit } = attempt);
        flattened = true;
      }
    }
    const message = document.createElement('p');
    message.textContent = `${meetsLimit ? 'Meets upload limit' : 'Over upload limit'}. ${describeSize(bytes.length)} of ${describeSize(limit)}.`;
    if (flattened) message.textContent += ' Review the image-based pages before submitting.';
    const download = document.createElement('a');
    download.className = 'button outline';
    download.textContent = 'Download PDF';
    download.download = 'document-ready.pdf';
    downloadUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    download.href = downloadUrl;
    result.classList.toggle('warning', !meetsLimit);
    result.append(message, makeButton('Preview PDF', () => showPreview(0, bytes)), download);
    result.hidden = false;
    announce(message.textContent);
  } catch (error) {
    announce(`Could not prepare the PDF. ${error.message}`);
  } finally {
    busy = false;
    settings.forEach((element) => { element.disabled = false; });
    draw();
  }
}

get('browse').addEventListener('click', () => files.click());
files.addEventListener('change', () => importFiles([...files.files]));
get('undo').addEventListener('click', () => {
  if (!history.length) return;
  pages = history.pop();
  clearResult();
  draw();
  if (!history.length) get('browse').focus();
  announce('Last change undone.');
});
get('clear').addEventListener('click', () => {
  saveHistory();
  pages = [];
  draw();
  get('undo').focus();
  announce('All pages cleared. You can undo this change.');
});
prepare.addEventListener('click', prepareExport);
limitInput.addEventListener('input', clearResult);
document.querySelectorAll('[name="mode"]').forEach((control) => control.addEventListener('change', clearResult));
get('close-preview').addEventListener('click', () => preview.close());
preview.addEventListener('close', () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
  get('preview-content').replaceChildren();
});
const drop = get('drop');
drop.addEventListener('dragover', (event) => {
  event.preventDefault();
  if (!busy) drop.classList.add('active');
});
drop.addEventListener('dragleave', (event) => {
  if (!drop.contains(event.relatedTarget)) drop.classList.remove('active');
});
drop.addEventListener('drop', (event) => {
  event.preventDefault();
  drop.classList.remove('active');
  importFiles([...event.dataTransfer.files]);
});
draw();
