import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy Uploadthing route to local Express handler in dev
      '/api/uploadthing': 'http://localhost:3001',
    },
  },
});
