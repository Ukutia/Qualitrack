import { useEffect, useMemo, useRef, useState } from 'react';
import { useDocumentFile, useDocumentSheets } from '../hooks/useApi.js';
import { loadPdfjs } from '../lib/pdfjs.js';

const FORMAT_STYLE = {
  pdf: {
    label: 'PDF',
    classes: 'bg-rose-50 text-rose-700 ring-rose-200',
  },
  doc: {
    label: 'DOC',
    classes: 'bg-blue-50 text-blue-700 ring-blue-200',
  },
  docx: {
    label: 'DOCX',
    classes: 'bg-blue-50 text-blue-700 ring-blue-200',
  },
  xls: {
    label: 'XLS',
    classes: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  xlsx: {
    label: 'XLSX',
    classes: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
};

export function documentExtension(document) {
  const match = String(document?.name || '').toLowerCase().match(/\.([^.]+)$/);
  const extension = match?.[1];
  return FORMAT_STYLE[extension] ? extension : document?.format || 'file';
}

export function DocumentFormatIcon({ document, compact = false }) {
  const extension = documentExtension(document);
  const style = FORMAT_STYLE[extension] || {
    label: extension.toUpperCase(),
    classes: 'bg-steel-100 text-steel-700 ring-steel-200',
  };

  return (
    <span
      aria-label={`Archivo ${style.label}`}
      className={`inline-flex shrink-0 flex-col items-center justify-center rounded-xl font-bold tracking-tight ring-1 ${style.classes} ${
        compact ? 'h-12 w-12 text-[10px]' : 'h-20 w-20 text-sm'
      }`}
    >
      <svg viewBox="0 0 24 24" className={compact ? 'mb-0.5 h-5 w-5' : 'mb-1 h-8 w-8'} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M6 2.75h7l5 5V21.25H6V2.75Z" strokeLinejoin="round" />
        <path d="M13 2.75v5h5" strokeLinejoin="round" />
      </svg>
      {style.label}
    </span>
  );
}

function Fallback({ document, message = 'Vista previa no disponible' }) {
  return (
    <div className="flex h-full min-h-44 flex-col items-center justify-center gap-3 bg-steel-50 px-4 text-center">
      <DocumentFormatIcon document={document} />
      <p className="text-xs font-medium text-steel-600">{message}</p>
    </div>
  );
}

function LoadingPreview() {
  return (
    <div className="flex h-full min-h-44 items-center justify-center bg-steel-50" role="status">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      <span className="sr-only">Generando vista previa…</span>
    </div>
  );
}

function PdfThumbnail({ data, document, onUnavailable }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let pdf;
    let task;

    (async () => {
      const pdfjs = await loadPdfjs();
      pdf = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(1.2, 520 / base.width);
      const viewport = page.getViewport({ scale });
      if (cancelled) return;

      const canvas = canvasRef.current;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      task = page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null,
      });
      await task.promise;
    })().catch(() => {
      if (!cancelled) onUnavailable();
    });

    return () => {
      cancelled = true;
      task?.cancel();
      pdf?.destroy();
    };
  }, [data, onUnavailable]);

  return (
    <div className="flex h-full items-start justify-center overflow-hidden bg-steel-100 p-3">
      <canvas ref={canvasRef} className="h-auto w-full bg-white shadow-sm" aria-label={`Primera página de ${document.name}`} />
    </div>
  );
}

function DocxThumbnail({ data, document, onUnavailable }) {
  const bodyRef = useRef(null);
  const styleRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { renderAsync } = await import('docx-preview');
      await renderAsync(new Blob([data]), bodyRef.current, styleRef.current, {
        className: 'docx',
        inWrapper: true,
        breakPages: true,
        ignoreLastRenderedPageBreak: false,
        renderHeaders: true,
        renderFooters: true,
        useBase64URL: true,
      });
      if (cancelled) return;
      const pages = bodyRef.current.querySelectorAll('section.docx');
      if (!pages.length) throw new Error('El DOCX no contiene páginas renderizables.');
      pages.forEach((page, index) => { if (index > 0) page.remove(); });
    })().catch(() => {
      if (!cancelled) onUnavailable();
    });

    return () => { cancelled = true; };
  }, [data, onUnavailable]);

  return (
    <div className="document-docx-thumbnail h-full overflow-hidden bg-steel-100" aria-label={`Primera página de ${document.name}`}>
      <div ref={styleRef} hidden />
      <div ref={bodyRef} />
    </div>
  );
}

function SheetThumbnail({ query, document, onUnavailable }) {
  useEffect(() => {
    if (query.isError || (query.isSuccess && !query.data?.sheets?.length)) onUnavailable();
  }, [query.isError, query.isSuccess, query.data, onUnavailable]);

  if (query.isPending) return <LoadingPreview />;
  if (query.isError || !query.data?.sheets?.length) return null;

  const sheet = query.data.sheets[0];
  const width = Math.min(8, sheet.rows.reduce((max, row) => Math.max(max, row.length), 0));

  return (
    <div className="h-full overflow-hidden bg-white" aria-label={`Primera hoja de ${document.name}`}>
      <p className="truncate border-b border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
        {sheet.name}
      </p>
      {sheet.rows.length ? (
        <table className="w-full table-fixed border-collapse text-[10px] text-steel-700">
          <tbody>
            {sheet.rows.slice(0, 10).map((row, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: width }, (_, columnIndex) => (
                  <td key={columnIndex} className="truncate border border-steel-100 px-1.5 py-1">
                    {row[columnIndex] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="p-5 text-center text-xs text-steel-500">La primera hoja está vacía.</p>
      )}
    </div>
  );
}

/** Miniatura generada solo cuando la tarjeta se acerca al área visible. */
export function DocumentThumbnail({ document }) {
  const rootRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const extension = documentExtension(document);
  const needsFile = enabled && ['pdf', 'docx'].includes(extension);
  const file = useDocumentFile(document.id, needsFile);
  const sheets = useDocumentSheets(document.id, enabled && ['xls', 'xlsx'].includes(extension), true);
  const onUnavailable = useMemo(() => () => setUnavailable(true), []);

  useEffect(() => {
    const element = rootRef.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setEnabled(true);
        observer.disconnect();
      }
    }, { rootMargin: '300px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (file.isError) setUnavailable(true);
  }, [file.isError]);

  let content = <LoadingPreview />;
  if (extension === 'doc') {
    content = <Fallback document={document} />;
  } else if (unavailable) {
    content = <Fallback document={document} />;
  } else if (!enabled) {
    content = <LoadingPreview />;
  } else if (extension === 'pdf' && file.data) {
    content = <PdfThumbnail data={file.data} document={document} onUnavailable={onUnavailable} />;
  } else if (extension === 'docx' && file.data) {
    content = <DocxThumbnail data={file.data} document={document} onUnavailable={onUnavailable} />;
  } else if (['xls', 'xlsx'].includes(extension)) {
    content = <SheetThumbnail query={sheets} document={document} onUnavailable={onUnavailable} />;
  } else if (!needsFile || file.isError) {
    content = <Fallback document={document} />;
  }

  return <div ref={rootRef} className="h-52 overflow-hidden">{content}</div>;
}

export { Fallback as DocumentPreviewFallback };
