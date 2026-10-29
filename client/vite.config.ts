import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the API runs on :4000; proxying keeps the browser same-origin (no CORS setup needed locally).
// In production the client calls VITE_API_URL directly and the server's CLIENT_ORIGIN allow-list applies.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          charts: ['recharts'],
        },
      },
    },
  },
});
