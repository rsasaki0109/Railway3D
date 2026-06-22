import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isPages = process.env.GITHUB_ACTIONS === 'true' && repository !== undefined;

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? (isPages ? `/${repository}/` : '/'),
  build: {
    sourcemap: true,
    target: 'baseline-widely-available',
    assetsInlineLimit: 4096,
  },
  worker: { format: 'es' },
});
