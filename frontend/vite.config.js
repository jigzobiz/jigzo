import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { assertPreviewFrontendSafety } from './previewSafety.js';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  assertPreviewFrontendSafety({ ...loadEnv(mode, process.cwd(), ''), ...process.env });
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true
        },
        '/uploads': {
          target: 'http://localhost:5000',
          changeOrigin: true
        }
      }
    }
  };
});
