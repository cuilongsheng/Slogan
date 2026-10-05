import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  envDir: mode === 'pages' ? false : '.',
  plugins: [react(), tailwindcss()],
  server: {
    host: 'localhost',
    port: 4173,
  },
  preview: {
    host: 'localhost',
    port: 4173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
}));
