import { searchSimilarChunks } from "../services/vector.service.js";
import { config } from '../config/env.js';


export async function semanticSearch(req, res, next) {
  try {
    if (!config.embeddings.enabled) {
      return res.status(503).json({
        code: 'EMBEDDINGS_DISABLED',
        error: 'La búsqueda semántica está desactivada en este entorno.',
      });
    }

    const {
      query,
      limit = 5,
      documentId = null,
    } = req.body || {};

    if (
      !query ||
      typeof query !== "string" ||
      !query.trim()
    ) {
      return res.status(400).json({
        error: "query es obligatorio.",
      });
    }

    const results = await searchSimilarChunks(
      query.trim(),
      {
        limit,
        documentId,
      }
    );

    return res.json({
      query: query.trim(),
      count: results.length,
      results,
    });
  } catch (error) {
    return next(error);
  }
}
