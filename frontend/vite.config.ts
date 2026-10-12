/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The User Guide lives in ../docs/user-guide (shared with the backend RAG index), so the dev
// server may read the parent folder. /api is proxied to the local Django server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  preview: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8000' } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}', 'src/vite-env.d.ts'],
      reporter: ['text-summary', 'json-summary', 'json'],
      reportsDirectory: '../coverage/frontend',
    },
    outputFile: { json: '../coverage/frontend/results.json' },
  },
});
