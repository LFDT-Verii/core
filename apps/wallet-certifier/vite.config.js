import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 14080,
    proxy: {
      '/api': process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:14081',
    },
  },
});
