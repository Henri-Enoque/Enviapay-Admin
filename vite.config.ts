import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/admin': {
        target: 'https://enviapay-production.up.railway.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
