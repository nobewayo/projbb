import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
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
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts'
  }
});
