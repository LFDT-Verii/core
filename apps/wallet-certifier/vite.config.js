import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 14080,
    proxy: {
      '/api': 'http://localhost:14081',
    },
  },
});
