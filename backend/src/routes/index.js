import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { enforceRolePolicy } from '../middleware/authorize.js';
import { requireOwnDocument, requireOwnAssociation } from '../middleware/ownership.js';
import { upload, structureUpload } from '../middleware/upload.js';
import { semanticSearch } from '../controllers/search.controller.js';
import { listTopics, createTopic, deleteTopic } from '../controllers/topics.controller.js';
import {
  listDrafts,
  createDraft,
  getDraft,
  updateDraft,
  deleteDraft,
  getDraftHistory,
  restoreDraftVersion,
} from '../controllers/reportDrafts.controller.js';
import { login, me } from '../controllers/auth.controller.js';
import {
  uploadDocument,
  listDocuments,
  getDocument,
  serveFile,
  updateDocumentDate,
  trashDocument,
  listTrash,
  restoreDocument,
  destroyDocument,
} from '../controllers/documents.controller.js';
import {
  classifyDocument,
  validateAssociation,
  rejectAssociation,
  reassignAssociation,
} from '../controllers/classification.controller.js';
import { getCompliance } from '../controllers/compliance.controller.js';
import {
  getCriterion,
  getReportStructure,
  uploadReportStructure,
  parseStructureDocument,
  getStructureHistory,
  restoreStructureVersion,
} from '../controllers/criteria.controller.js';
import * as cloud from '../controllers/cloud.controller.js';

const router = Router();

// Health
router.get('/health', (req, res) => res.json({ status: 'ok' }));

// Auth
router.post('/auth/login', login);
router.get('/auth/me', requireAuth, me);

// Google OAuth callback es público (Google redirige sin token; usa "state").
router.get('/cloud/google/callback', cloud.callback);

// Dropbox callback público
router.get('/cloud/dropbox/callback', cloud.dropboxCallback);

// A partir de aquí, todo requiere autenticación y un rol con permiso sobre la
// ruta (EP 1.1 · EP 1.2). La política es de denegación por defecto y se resuelve
// antes de consultar la base de datos.
router.use(requireAuth);
router.use(enforceRolePolicy);

// Búsqueda semántica
router.post('/search/semantic', semanticSearch);

// Temáticas
router.get('/topics', listTopics);
router.post('/topics', createTopic);
router.delete('/topics/:id', deleteTopic);

// Documentos (HU07)
router.post('/documents', upload.single('file'), uploadDocument);
router.get('/documents', listDocuments);
router.get('/documents/trash', listTrash);
router.get('/documents/:id', requireOwnDocument, getDocument);
router.get('/documents/:id/file', requireOwnDocument, serveFile);
router.patch('/documents/:id/date', requireOwnDocument, updateDocumentDate);
router.post('/documents/:id/trash', trashDocument);
router.post('/documents/:id/restore', restoreDocument);
router.delete('/documents/:id', destroyDocument);

// Clasificación (HU01)
router.post('/documents/:id/classify', requireOwnDocument, classifyDocument);
router.post('/associations/:id/validate', requireOwnAssociation, validateAssociation);
router.post('/associations/:id/reject', requireOwnAssociation, rejectAssociation);
router.put('/documents/:id/association', requireOwnDocument, reassignAssociation);

// Cumplimiento (HU02)
router.get('/compliance', getCompliance);

// Criterio y estructura del informe (HU03)
router.get('/criteria', getCriterion);
router.get('/report-structure', getReportStructure);
router.get('/report-structure/history', getStructureHistory);
router.post('/report-structure', uploadReportStructure);
router.post('/report-structure/parse', structureUpload.single('file'), parseStructureDocument);
router.post('/report-structure/:version/restore', restoreStructureVersion);

// Redacción del informe — borradores
router.get('/report-drafts', listDrafts);
router.post('/report-drafts', createDraft);
router.get('/report-drafts/:id', getDraft);
router.put('/report-drafts/:id', updateDraft);
router.delete('/report-drafts/:id', deleteDraft);
router.get('/report-drafts/:id/history', getDraftHistory);
router.post('/report-drafts/:id/versions/:version/restore', restoreDraftVersion);

// Google Drive (HU09)
router.get('/cloud/google/status', cloud.status);
router.get('/cloud/google/auth-url', cloud.authUrl);
router.get('/cloud/google/files', cloud.listFiles);
router.post('/cloud/google/import', cloud.importFile);

// Dropbox (HU10)
// Dropbox (HU09)
router.get('/cloud/dropbox/status',   cloud.dropboxStatus);
router.get('/cloud/dropbox/auth-url', cloud.dropboxAuthUrl);
router.get('/cloud/dropbox/files',    cloud.dropboxListFiles);
router.post('/cloud/dropbox/import',  cloud.dropboxImportFile);

router.delete('/cloud/:provider/disconnect', cloud.disconnect);
export default router;
