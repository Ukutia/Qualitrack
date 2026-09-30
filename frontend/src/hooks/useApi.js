import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api.js';
import { normalizeAnalysisStatus, isAnalysisInProgress } from '../lib/analysisStatus.js';
import { watchAnalysis } from '../lib/analysisWatch.js';

const DOCUMENT_IMPORT_TIMEOUT = 300000; // 5 minutos

function shouldPollDocuments(data) {
  if (!Array.isArray(data)) return false;
  return data.some((doc) => {
    const status = doc.analysisStatus || doc.vectorizationStatus;
    return status !== 'completado' && status !== 'error';
  });
}

// ── Solicitudes de documentos ──────────────────────────────────────
export function useDocumentRequests() {
  return useQuery({
    queryKey: ['document-requests'],
    queryFn: async () => (await api.get('/document-requests')).data,
    refetchInterval: 2000,
  });
}

export function useDocumentRequestConfig() {
  return useQuery({
    queryKey: ['document-requests', 'config'],
    queryFn: async () => (await api.get('/document-requests/config')).data,
    staleTime: Infinity,
  });
}

export function usePublicDocumentRequest(token) {
  return useQuery({
    queryKey: ['public-document-request', token],
    queryFn: async () => (await api.get(`/document-requests/public/${encodeURIComponent(token)}`)).data,
    enabled: Boolean(token),
    retry: false,
  });
}

export function useUploadPublicDocumentRequest(token) {
  return useMutation({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append('file', file);
      return (
        await api.post(`/document-requests/public/${encodeURIComponent(token)}/upload`, form, {
          timeout: DOCUMENT_IMPORT_TIMEOUT,
        })
      ).data;
    },
  });
}

export function useCreateDocumentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await api.post('/document-requests', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document-requests'] }),
  });
}

export function useDocumentRequestAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }) =>
      (await api.post(`/document-requests/${id}/${action}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document-requests'] }),
  });
}

export function useDeleteDocumentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/document-requests/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document-requests'] }),
  });
}

// ── Documentos (HU07) ───────────────────────────────────────────────
export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: async () => (await api.get('/documents')).data,
    refetchInterval: (query) => (shouldPollDocuments(query.state.data) ? 2000 : false),
  });
}

// ── Búsqueda semántica ──────────────────────────────────────────────
export function useSemanticSearch() {
  return useMutation({
    mutationFn: async ({ query, limit = 30 }) =>
      (
        await api.post('/search/semantic', {
          query,
          limit,
        })
      ).data,
  });
}

// ── Pasajes (visor de fragmentos) ──────────────────────────────────
// 404/410 significan que el documento ya no existe, está en la papelera o
// perdió su archivo: no tiene sentido reintentar.
const noRetryWhenGone = (count, error) =>
  ![404, 410].includes(error?.response?.status) && count < 2;

export function usePassage(documentId, chunkIndex) {
  return useQuery({
    queryKey: ['passage', documentId, chunkIndex],
    queryFn: async () => (await api.get(`/documents/${documentId}/passages/${chunkIndex}`)).data,
    retry: noRetryWhenGone,
  });
}

/** Oraciones del fragmento relacionadas con la temática (tarda unos segundos). */
export function usePassageFocus(documentId, chunkIndex, query, enabled) {
  return useQuery({
    queryKey: ['passage-focus', documentId, chunkIndex, query],
    enabled: enabled && !!query,
    staleTime: Infinity,
    queryFn: async () =>
      (await api.get(`/documents/${documentId}/passages/${chunkIndex}/focus`, { params: { q: query } })).data,
    retry: noRetryWhenGone,
  });
}

export function useDocumentFile(documentId, enabled) {
  return useQuery({
    queryKey: ['document-file', documentId],
    enabled,
    staleTime: Infinity,
    gcTime: 60_000,
    retry: noRetryWhenGone,
    queryFn: async () =>
      (await api.get(`/documents/${documentId}/file`, { responseType: 'arraybuffer' })).data,
  });
}

export function useDocumentSheets(documentId, enabled) {
  return useQuery({
    queryKey: ['document-sheets', documentId],
    enabled,
    staleTime: Infinity,
    retry: noRetryWhenGone,
    queryFn: async () => (await api.get(`/documents/${documentId}/sheets`)).data,
  });
}

// ── Temáticas ───────────────────────────────────────────────────────
export function useTopics() {
  return useQuery({
    queryKey: ['topics'],
    queryFn: async () => (await api.get('/topics')).data,
  });
}

export function useCreateTopic() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (name) =>
      (
        await api.post('/topics', {
          name,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics'] });
    },
  });
}

export function useDeleteTopic() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id) =>
      (await api.delete(`/topics/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics'] });
    },
  });
}

// Tiempo mínimo que cada etapa del análisis queda en pantalla. Varias etapas
// (recibido por el analizador, extrayendo contenido, recibiendo resultado)
// duran milisegundos: aplicadas tal cual llegan, React las pisa antes de que
// alguien alcance a leerlas.
const MIN_STAGE_MS = 700;

export function useDocument(id) {
  const qc = useQueryClient();
  // Con el stream abierto sobra el sondeo, y además estorba: una respuesta
  // del sondeo puede adelantarse a la cola de etapas y hacer retroceder el
  // estado en pantalla.
  const streamOpen = useRef(false);

  useEffect(() => {
    if (!id) return undefined;

    const token = localStorage.getItem('qualitrack_token');
    const streamUrl = `${api.defaults.baseURL || '/api'}/documents/${id}/stream?token=${encodeURIComponent(token || '')}`;
    const source = new EventSource(streamUrl);
    const queue = [];
    let timer = null;
    let shownAt = 0;
    let lastQueued = null;

    const apply = (payload) => {
      shownAt = Date.now();
      const previous = qc.getQueryData(['document', id]);

      qc.setQueryData(['document', id], (old) => old ? {
        ...old,
        analysisStatus: payload.analysisStatus,
        analysisError: payload.analysisError ?? null,
        analysisSummary: payload.analysisSummary ?? old.analysisSummary,
        analysisEngine: payload.analysisEngine ?? old.analysisEngine,
        vectorizationStatus: payload.vectorizationStatus ?? old.vectorizationStatus,
      } : old);

      // Al terminar llegan la propuesta y su historial, que el evento no trae:
      // se recarga la ficha completa. Solo si el estado cambió, para no
      // recargar al abrir un documento ya analizado.
      const changed =
        normalizeAnalysisStatus(previous?.analysisStatus) !== normalizeAnalysisStatus(payload.analysisStatus);
      if (changed && !isAnalysisInProgress(payload.analysisStatus)) {
        qc.invalidateQueries({ queryKey: ['document', id] });
        qc.invalidateQueries({ queryKey: ['documents'] });
      }
    };

    const drain = () => {
      timer = null;
      const next = queue.shift();
      if (!next) return;
      apply(next);
      if (queue.length) timer = setTimeout(drain, MIN_STAGE_MS);
    };

    source.addEventListener('document-status', (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      // El bus y el sondeo del backend pueden informar el mismo cambio.
      const key = `${normalizeAnalysisStatus(payload.analysisStatus)}|${payload.vectorizationStatus}`;
      if (key === lastQueued) return;
      lastQueued = key;

      queue.push(payload);
      if (!timer) timer = setTimeout(drain, Math.max(0, shownAt + MIN_STAGE_MS - Date.now()));
    });

    source.onopen = () => { streamOpen.current = true; };
    source.onerror = () => { streamOpen.current = false; };

    return () => {
      clearTimeout(timer);
      source.close();
      streamOpen.current = false;
    };
  }, [id, qc]);

  return useQuery({
    queryKey: ['document', id],
    queryFn: async () => (await api.get(`/documents/${id}`)).data,
    enabled: !!id,
    // Respaldo por si el stream se corta: mientras el análisis sigue en curso
    // se consulta cada 2 s.
    refetchInterval: (query) =>
      !streamOpen.current && isAnalysisInProgress(query.state.data?.analysisStatus) ? 2000 : false,
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, onDuplicate }) => {
      const form = new FormData();
      form.append('file', file);
      const q = onDuplicate ? `?onDuplicate=${onDuplicate}` : '';
      return (
        await api.post(`/documents${q}`, form, {
          timeout: DOCUMENT_IMPORT_TIMEOUT,
        })
      ).data;
    },
    onSuccess: () => {
      // No bloquear la resolución de mutateAsync...
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useTrashDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.post(`/documents/${id}/trash`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['trash'] });
      qc.invalidateQueries({ queryKey: ['compliance'] });
    },
  });
}

export function useTrash() {
  return useQuery({
    queryKey: ['trash'],
    queryFn: async () => (await api.get('/documents/trash')).data,
  });
}

export function useRestoreDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.post(`/documents/${id}/restore`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['trash'] });
      qc.invalidateQueries({ queryKey: ['compliance'] });
    },
  });
}

export function useDestroyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/documents/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trash'] }),
  });
}

// ── Clasificación (HU01) ────────────────────────────────────────────
export function useClassify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (docId) => (await api.post(`/documents/${docId}/classify`)).data,
    onSuccess: (data, docId) => {
      watchAnalysis(docId);
      // Las etapas siguientes llegan por el stream. Recargar la ficha aquí
      // podía traer una etapa más nueva que la que la cola está mostrando y
      // hacer retroceder el estado; solo se marca el inicio, y solo si el
      // stream no se adelantó ya con una etapa posterior.
      qc.setQueryData(['document', docId], (old) =>
        old && !isAnalysisInProgress(old.analysisStatus)
          ? { ...old, analysisStatus: data.analysisStatus, analysisError: null }
          : old
      );
    },
  });
}

export function useAssociationAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ associationId, action, documentId }) =>
      (await api.post(`/associations/${associationId}/${action}`)).data,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['compliance'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
      if (variables.documentId) {
        qc.invalidateQueries({ queryKey: ['document', String(variables.documentId)] });
        qc.invalidateQueries({ queryKey: ['document', variables.documentId] });
      }
    },
  });
}

/** EP 1.2 — reasignación manual del subcriterio de un documento. */
export function useReassignAssociation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId, subcriterionId }) =>
      (await api.put(`/documents/${documentId}/association`, { subcriterionId })).data,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['compliance'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['document', String(variables.documentId)] });
      qc.invalidateQueries({ queryKey: ['document', variables.documentId] });
    },
  });
}

/** Criterio 9 con sus subcriterios (para elegir a mano). */
export function useCriterion() {
  return useQuery({
    queryKey: ['criteria'],
    queryFn: async () => (await api.get('/criteria')).data,
  });
}

// ── Cumplimiento (HU02) ─────────────────────────────────────────────
export function useCompliance() {
  return useQuery({
    queryKey: ['compliance'],
    queryFn: async () => (await api.get('/compliance')).data,
  });
}

// ── Estructura del informe (HU03) ───────────────────────────────────
export function useReportStructure() {
  return useQuery({
    queryKey: ['report-structure'],
    queryFn: async () => (await api.get('/report-structure')).data,
  });
}

export function useUploadStructure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sections) => (await api.post('/report-structure', { sections })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-structure'] }),
  });
}

export function useParseStructureDoc() {
  return useMutation({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append('file', file);
      return (await api.post('/report-structure/parse', form)).data;
    },
  });
}

export function useStructureHistory() {
  return useQuery({
    queryKey: ['report-structure-history'],
    queryFn: async () => (await api.get('/report-structure/history')).data,
  });
}

export function useRestoreStructure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (version) => (await api.post(`/report-structure/${version}/restore`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-structure'] });
      qc.invalidateQueries({ queryKey: ['report-structure-history'] });
    },
  });
}

// ── Redacción del informe (borradores) ──────────────────────────────
export function useReportDrafts() {
  return useQuery({
    queryKey: ['report-drafts'],
    queryFn: async () => (await api.get('/report-drafts')).data,
  });
}

export function useReportDraft(id) {
  return useQuery({
    queryKey: ['report-draft', id],
    queryFn: async () => (await api.get(`/report-drafts/${id}`)).data,
    enabled: !!id,
    // El contenido vive en el editor mientras se redacta: un refetch
    // pisaría lo que el usuario está escribiendo.
    staleTime: Infinity,
    gcTime: 0,
  });
}

export function useCreateReportDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload = {}) => (await api.post('/report-drafts', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-drafts'] }),
  });
}

export function useSaveReportDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title, contentHtml }) => {
      const body = {};
      if (title !== undefined) body.title = title;
      if (contentHtml !== undefined) body.contentHtml = contentHtml;
      return (await api.put(`/report-drafts/${id}`, body)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-drafts'] }),
  });
}

export function useDeleteReportDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/report-drafts/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-drafts'] }),
  });
}

export function useReportDraftHistory(id) {
  return useQuery({
    queryKey: ['report-draft-history', id],
    queryFn: async () => (await api.get(`/report-drafts/${id}/history`)).data,
    enabled: !!id,
  });
}

export function useRestoreReportDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }) =>
      (await api.post(`/report-drafts/${id}/versions/${version}/restore`)).data,
    onSuccess: (data, { id }) => {
      // Se escribe la respuesta directo en la caché en vez de solo invalidar:
      // `useReportDraft` tiene staleTime Infinity y el remontaje del editor
      // no debe correr contra un refetch todavía en vuelo.
      qc.setQueryData(['report-draft', id], (prev) =>
        prev ? { ...prev, title: data.title, contentHtml: data.contentHtml, updatedAt: data.updatedAt } : prev
      );
      qc.invalidateQueries({ queryKey: ['report-drafts'] });
      qc.invalidateQueries({ queryKey: ['report-draft-history', id] });
    },
  });
}

// ── Google Drive (HU09) ─────────────────────────────────────────────
export function useCloudStatus() {
  return useQuery({
    queryKey: ['cloud-status'],
    queryFn: async () => (await api.get('/cloud/google/status')).data,
  });
}

export function useCloudFiles(folderId, enabled) {
  return useQuery({
    queryKey: ['cloud-files', folderId || 'root'],
    queryFn: async () =>
      (await api.get('/cloud/google/files', { params: { folderId } })).data,
    enabled,
  });
}

export function useImportCloudFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ fileId, location, onDuplicate }) => {
      const q = onDuplicate ? `?onDuplicate=${onDuplicate}` : '';
      return (
        await api.post(
          `/cloud/google/import${q}`,
          { fileId, location },
          { timeout: DOCUMENT_IMPORT_TIMEOUT }
        )
      ).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

// ── Dropbox (HU10) ──────────────────────────────────────────────────
export function useDropboxStatus() {
  return useQuery({
    queryKey: ['dropbox-status'],
    queryFn: async () => (await api.get('/cloud/dropbox/status')).data,
  });
}

export function useDropboxFiles(folderPath, enabled) {
  return useQuery({
    queryKey: ['dropbox-files', folderPath || ''],
    queryFn: async () =>
      (await api.get('/cloud/dropbox/files', { params: { folderPath } })).data,
    enabled,
  });
}

export function useImportDropboxFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ fileId, location, onDuplicate }) => {
      const q = onDuplicate ? `?onDuplicate=${onDuplicate}` : '';
      return (
        await api.post(
          `/cloud/dropbox/import${q}`,
          { fileId, location },
          { timeout: DOCUMENT_IMPORT_TIMEOUT }
        )
      ).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}
