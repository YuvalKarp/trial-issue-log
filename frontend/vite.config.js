import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the frontend runs on its own port and forwards API calls to the server,
    // so the browser sees a single origin (as it will in production) and CORS is not needed.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
