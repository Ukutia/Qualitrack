import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useDocumentFile } from '../hooks/useApi.js';
import PdfPassage from './passage/PdfPassage.jsx';
import DocxPassage from './passage/DocxPassage.jsx';
import SheetPassage from './passage/SheetPassage.jsx';
import { DocumentFormatIcon, DocumentPreviewFallback, documentExtension } from './DocumentPreview.jsx';
import '../pages/PassageViewer.css';

const ignoreLocation = () => {};

const MIME = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

async function downloadOriginal(document, cachedData) {
  const data = cachedData || (
    await api.get(`/documents/${document.id}/file`, { responseType: 'arraybuffer' })
  ).data;
  const extension = documentExtension(document);
  const url = URL.createObjectURL(new Blob([data], { type: MIME[extension] || 'application/octet-stream' }));
  const link = window.document.createElement('a');
  link.href = url;
  link.download = document.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DocumentFileModal({ document, onClose }) {
  const extension = documentExtension(document);
  const needsFile = ['pdf', 'docx'].includes(extension);
  const file = useDocumentFile(document.id, needsFile);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  useEffect(() => {
    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(false);
    try {
      await downloadOriginal(document, file.data);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  }

  let preview;
  if (extension === 'doc') {
    preview = <DocumentPreviewFallback document={document} message="Este formato Word antiguo no admite vista previa. Puedes descargar el archivo original." />;
  } else if (needsFile && file.isPending) {
    preview = (
      <div className="grid min-h-80 place-items-center" role="status">
        <div className="text-center text-sm text-steel-600">
          <span className="mx-auto mb-3 block h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          Preparando archivo…
        </div>
      </div>
    );
  } else if (needsFile && file.isError) {
    preview = <DocumentPreviewFallback document={document} />;
  } else if (extension === 'pdf' && file.data) {
    preview = <PdfPassage data={file.data} passage="" focus="" onLocated={ignoreLocation} />;
  } else if (extension === 'docx' && file.data) {
    preview = <DocxPassage data={file.data} passage="" focus="" onLocated={ignoreLocation} />;
  } else if (['xls', 'xlsx'].includes(extension)) {
    preview = <SheetPassage documentId={document.id} passage="" focus="" onLocated={ignoreLocation} />;
  } else {
    preview = <DocumentPreviewFallback document={document} />;
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-ink-900/70 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-file-title"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl2 bg-white shadow-2xl ring-1 ring-white/20">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-steel-200 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <DocumentFormatIcon document={document} compact />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-steel-500">Vista del archivo</p>
              <h2 id="document-file-title" className="truncate font-display text-lg font-semibold text-ink-900">
                {document.name}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista del archivo"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-steel-500 ring-1 ring-steel-200 hover:bg-steel-50 hover:text-ink-900"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="passage-document min-h-0 flex-1 overflow-auto rounded-none bg-steel-100">
          {preview}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-steel-200 px-4 py-3 sm:px-6">
          <p className="text-xs text-steel-500">
            {downloadError ? <span className="text-rose-600">No fue posible descargar el archivo.</span> : 'La vista previa no modifica el documento original.'}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-steel-600 hover:bg-steel-50">
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {downloading ? 'Descargando…' : 'Descargar original'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
