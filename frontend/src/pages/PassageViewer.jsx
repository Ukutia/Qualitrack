import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { usePassage, usePassageFocus, useDocumentFile } from '../hooks/useApi.js';
import useDocumentMeta from '../lib/useDocumentMeta.js';
import PdfPassage from '../components/passage/PdfPassage.jsx';
import DocxPassage from '../components/passage/DocxPassage.jsx';
import SheetPassage from '../components/passage/SheetPassage.jsx';
import './PassageViewer.css';

const isGone = (error) => [404, 410].includes(error?.response?.status);

function BackLink() {
  const navigate = useNavigate();
  // Desde la búsqueda se vuelve atrás para conservar los resultados en pantalla.
  const hasHistory = window.history.state?.idx > 0;
  return hasHistory ? (
    <button type="button" onClick={() => navigate(-1)} className="text-sm text-brand-600 hover:underline">
      ← Volver a los resultados
    </button>
  ) : (
    <Link to="/search" className="text-sm text-brand-600 hover:underline">← Ir a la búsqueda temática</Link>
  );
}

function Unavailable() {
  return (
    <div className="space-y-6">
      <BackLink />
      <div role="alert" className="rounded-xl2 bg-white px-6 py-14 text-center shadow-soft ring-1 ring-stone-200/60">
        <svg viewBox="0 0 24 24" className="mx-auto h-10 w-10 text-stone-400" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M9.5 12.5l5 5m0-5-5 5" />
        </svg>
        <h1 className="mt-4 font-display text-2xl font-semibold text-ink-900">Documento no disponible</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">
          El documento original fue eliminado o su archivo ya no está en el repositorio,
          por lo que este pasaje no se puede abrir.
        </p>
      </div>
    </div>
  );
}

export default function PassageViewer() {
  const { id, chunkIndex } = useParams();
  const [params] = useSearchParams();
  const topic = params.get('q')?.trim() || '';
  const passageQuery = usePassage(id, chunkIndex);
  const doc = passageQuery.data?.document;
  const passage = passageQuery.data?.passage?.content ?? null;
  const focusQuery = usePassageFocus(id, chunkIndex, topic, !!passage);
  const focusItems = focusQuery.data?.focus;
  const focusPending = !!topic && focusQuery.isPending;
  // undefined = el foco se está calculando (el fragmento queda tenue);
  // null = no hay foco (se destaca el fragmento completo). Referencia estable
  // porque los visores vuelven a resaltar cuando cambia.
  const focus = useMemo(
    () => (focusPending ? undefined : focusItems?.map((f) => f.text) ?? null),
    [focusPending, focusItems],
  );
  const needsFile = doc?.format === 'pdf' || doc?.format === 'docx';
  const file = useDocumentFile(id, needsFile);
  const [location, setLocation] = useState(null);

  useDocumentMeta({ title: doc ? `Pasaje · ${doc.originalName}` : 'Pasaje', description: 'Fragmento de evidencia en su documento original.' });

  if (isGone(passageQuery.error) || isGone(file.error)) return <Unavailable />;
  if (passageQuery.isPending) return <p role="status" className="text-sm text-stone-500">Abriendo el documento…</p>;
  if (passageQuery.isError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p role="alert" className="text-sm text-rose-600">
          {passageQuery.error?.response?.data?.error || 'No fue posible abrir el pasaje.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <BackLink />

      <header className="rounded-xl2 bg-white p-5 shadow-soft ring-1 ring-stone-200/60">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words font-display text-2xl font-semibold tracking-tight text-ink-900">{doc.originalName}</h1>
            <p className="mt-1 text-sm text-stone-500" aria-live="polite">
              <span className="uppercase">{doc.format}</span>
              {location && <> · {location.label}</>}
            </p>
          </div>
          <Link to={`/documents/${doc.id}`} className="shrink-0 text-sm font-medium text-brand-600 hover:text-brand-700">
            Ficha de la evidencia →
          </Link>
        </div>

        {passage ? (
          <>
            {topic && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">
                  Relación con «{topic}»
                </p>
                {focusPending ? (
                  <p role="status" className="mt-1 text-sm text-stone-500">
                    Identificando las oraciones que se relacionan con la temática…
                  </p>
                ) : focusItems?.length ? (
                  <ul className="passage-focus-list">
                    {focusItems.map((f) => <li key={f.text}>{f.text}</li>)}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-stone-500">
                    No fue posible identificar las oraciones relacionadas; se resalta el fragmento completo.
                  </p>
                )}
              </div>
            )}
            <details className="passage-quote mt-4" open={!topic}>
              <summary>
                Fragmento completo ({Number(chunkIndex) + 1})
                {location && !location.found && <span className="ml-2 font-normal normal-case text-amber-700">· no se pudo ubicar en el documento</span>}
                {location?.found && !location.exact && <span className="ml-2 font-normal normal-case text-stone-400">· ubicación aproximada</span>}
              </summary>
              <p>{passage}</p>
            </details>
          </>
        ) : (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            El fragmento ya no existe (el documento se volvió a procesar). Se muestra el documento completo.
          </p>
        )}
      </header>

      <section aria-label="Documento" className="passage-document">
        {doc.format === 'xlsx' ? (
          <SheetPassage documentId={doc.id} passage={passage} focus={focus} onLocated={setLocation} />
        ) : file.isPending ? (
          <p role="status" className="p-6 text-sm text-stone-500">Descargando el documento…</p>
        ) : file.isError ? (
          <p role="alert" className="p-6 text-sm text-rose-600">No fue posible descargar el documento.</p>
        ) : doc.format === 'pdf' ? (
          <PdfPassage data={file.data} passage={passage} focus={focus} onLocated={setLocation} />
        ) : (
          <DocxPassage data={file.data} passage={passage} focus={focus} onLocated={setLocation} />
        )}
      </section>
    </div>
  );
}
