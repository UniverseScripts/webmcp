import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Multi-page rather than a client router: /debug is a separate document, so it
// registers no product tools of its own and cannot perturb what the agent sees
// on the main page. Vercel serves debug.html at /debug via clean URLs.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        debug: resolve(import.meta.dirname, 'debug.html'),
      },
    },
  },
});
