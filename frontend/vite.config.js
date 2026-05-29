import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El backend dentro de docker-compose es accesible como http://backend:4000.
// En local sin Docker, por defecto http://localhost:4000.
const target = process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    // En Docker se usa 5173 (mapeado al host); herramientas externas pueden
    // asignar otro puerto vía la variable PORT.
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/api': {
        target,
        changeOrigin: true,
      },
    },
  },
});
