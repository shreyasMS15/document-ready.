import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        workspace: fileURLToPath(new URL('index.html', import.meta.url)),
        licenses: fileURLToPath(new URL('licenses.html', import.meta.url)),
      },
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/pdfjs-dist/')) return 'pdf-renderer';
          if (id.includes('/node_modules/')) return 'pdf-writer';
        },
      },
    },
  },
});
