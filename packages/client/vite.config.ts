import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const schemasDistDir = fileURLToPath(new URL('../schemas/dist/', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@bitby/schemas',
        replacement: path.join(schemasDistDir, 'index.js')
      },
      {
        find: '@bitby/schemas/',
        replacement: schemasDistDir
      }
    ]
  },
  server: {
    port: 5173,
    host: '0.0.0.0'
  },
  preview: {
    port: 4173,
    host: '0.0.0.0'
  }
});
