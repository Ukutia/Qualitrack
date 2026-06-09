import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { upload, structureUpload } from '../middleware/upload.js';

import { login, me } from '../controllers/auth.controller.js';
import {
  uploadDocument,
  listDocuments,
  getDocument,
  serveFile,
  updateDocumentDate,
} from '../controllers/documents.controller.js';
import {
  classifyDocument,
  validateAssociation,
  rejectAssociation,
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

// A partir de aquí, todo requiere autenticación.
router.use(requireAuth);

// Documentos (HU07)
router.post('/documents', upload.single('file'), uploadDocument);
router.get('/documents', listDocuments);
router.get('/documents/:id', getDocument);
router.get('/documents/:id/file', serveFile);
router.patch('/documents/:id/date', updateDocumentDate);

// Clasificación (HU01)
router.post('/documents/:id/classify', classifyDocument);
router.post('/associations/:id/validate', validateAssociation);
router.post('/associations/:id/reject', rejectAssociation);

// Cumplimiento (HU02)
router.get('/compliance', getCompliance);

// Criterio y estructura del informe (HU03)
router.get('/criteria', getCriterion);
router.get('/report-structure', getReportStructure);
router.get('/report-structure/history', getStructureHistory);
router.post('/report-structure', uploadReportStructure);
router.post('/report-structure/parse', structureUpload.single('file'), parseStructureDocument);
router.post('/report-structure/:version/restore', restoreStructureVersion);

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
