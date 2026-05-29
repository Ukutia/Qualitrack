import express from 'express';
import cors from 'cors';
import path from 'path';
import router from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { config } from './config/env.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  app.use('/api', router);

  // Producción (single-service): servir el frontend compilado en el mismo
  // origen que la API. FRONTEND_DIST apunta a la carpeta del build de Vite.
  const distDir = process.env.FRONTEND_DIST;
  if (distDir) {
    app.use(express.static(distDir));
    // SPA fallback: cualquier ruta que NO sea /api devuelve index.html
    // para que funcione el enrutamiento del lado del cliente.
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
