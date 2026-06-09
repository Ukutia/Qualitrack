import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El backend dentro de docker-compose es accesible como http://backend:4000.
// En local sin Docker, por defecto http://localhost:4000.
const target = process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 5173,
    // Windows + Docker no tiene inotify confiable; polling garantiza HMR.
    watch: { usePolling: true },
    proxy: {
      '/api': {
        target,
        changeOrigin: true,
      },
    },
  },
});
