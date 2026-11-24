# Document Ready

Document Ready helps people prepare school, job, benefits, and other application documents when an upload form expects one PDF with a strict size limit. It runs in a browser and processes inputs locally.

## Try the demo

With Node.js 20.19+ or 22.12+ installed, run the following from the project folder.

```sh
npm ci
npm run dev -- --port 8000 --strictPort
```

Open [localhost:8000](http://localhost:8000) on the same computer.

## Prepare a document

1. Add PDFs or photos from a phone or computer.
2. Preview the pages and put them in the right order. Remove any extras.
3. Enter the size limit from the upload form. Choose whether to keep page quality or try compression.
4. Check the measured size and preview the export before downloading it.

The app uses 1 KB = 1,000 bytes. If the export exceeds your limit, the app shows the actual size.

## Privacy and limitations

- The app bundles its dependencies and has no upload endpoint, telemetry, third-party fonts, or account. Inputs, previews, and undo history live in memory until the tab closes. Downloads are saved where the browser places them.
- Supported inputs are PDF, JPEG, PNG, and WebP, up to 60 pages and 80 MB of input files per session. Password-protected PDFs are unsupported.
- Keep page quality copies existing PDF page content. Rebuilding a PDF can change or drop document-level features, including signatures, interactive forms, bookmarks, and links. Use the original if these are required.
- Compression can flatten text and links into page images and make small print harder to read. It does not add OCR. Review the exported pages before submitting.
- Document Ready checks size. The receiving service determines whether a file meets its other requirements.

## Build and test

Run `npm test` for the export logic tests. Run `npm run build` to produce a static site in `dist/`. Run `npm run preview` to test that build locally. A static host can serve `dist/` without a backend.

## Contribute

Bug reports about phone browsers, page order, PDF rendering, and unreadable exports are welcome. Please include the browser, the steps to reproduce, and a synthetic sample or a public document. Keep personal documents out of issues and pull requests.

The [MIT License](LICENSE) applies to Document Ready. PDF rendering uses [PDF.js](https://github.com/mozilla/pdf.js), and PDF assembly uses [pdf-lib](https://github.com/Hopding/pdf-lib).
