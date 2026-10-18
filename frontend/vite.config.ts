import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// LifeLink Frontend Configuration - Reloaded
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/chat': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/api/camps': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/api/districts': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/api/blood-groups': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/api/blood-availability': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/api/upload-pdf': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/api/documents': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/api/status': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      },
      '/chat': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/chat/, '')
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-icons': ['lucide-react'],
          'vendor-maps': ['leaflet']
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
});
