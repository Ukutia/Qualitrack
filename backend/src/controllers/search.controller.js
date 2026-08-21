import { searchSimilarChunks } from "../services/vector.service.js";


export async function semanticSearch(req, res, next) {
  try {
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