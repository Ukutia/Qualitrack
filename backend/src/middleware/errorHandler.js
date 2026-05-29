import multer from 'multer';
import { config } from '../config/env.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Errores de Multer (p. ej. tamaño máximo superado) -> HU07.
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: `El archivo supera el tamaño máximo de ${config.maxFileSizeMb}MB. ` +
          'Reduzca el tamaño del documento o divídalo antes de cargarlo.',
        code: 'FILE_TOO_LARGE',
      });
    }
    return res.status(400).json({ error: `Error al cargar el archivo: ${err.message}` });
  }

  // Errores de validación de formato lanzados por el filtro de Multer.
  if (err && err.code === 'INVALID_FORMAT') {
    return res.status(400).json({ error: err.message, code: 'INVALID_FORMAT' });
  }

  console.error(err);
  return res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor.',
  });
}
