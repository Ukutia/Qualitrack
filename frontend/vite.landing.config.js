import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build aislado que solo empaqueta la landing pública (sin router, auth ni
// react-query), para hostear nada más que esa página en un servidor estático.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-landing',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'landing.html'),
    },
  },
});
