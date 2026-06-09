import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDocument, useClassify, useAssociationAction, useTrashDocument } from '../hooks/useApi.js';

const fmtDate = (d) => (d ? new Date(d).toLocaleString('es-CL') : '—');
const ACTION_LABEL = { PROPOSED: 'Propuesta generada', VALIDATED: 'Validada', REJECTED: 'Descartada' };
const STATUS_LABEL = { PROPOSED: 'Propuesta', VALIDATED: 'Validada', NOT_VALIDATED: 'Descartada' };

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: doc, isLoading } = useDocument(id);
  const classify = useClassify();
  const action = useAssociationAction();
  const trash = useTrashDocument();

  if (isLoading) return <p className="text-slate-500">Cargando documento…</p>;
  if (!doc) return <p className="text-rose-600">Documento no encontrado.</p>;

  const classifyResult = classify.data;
  const hasValidated = doc.associations.some((a) => a.status === 'VALIDATED');

  async function handleTrash() {
    if (!confirm('¿Mover este documento a la papelera? Podrás restaurarlo después.')) return;
    await trash.mutateAsync(id);
    navigate('/documents');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/documents" className="text-sm text-brand-600 hover:underline">
          ← Volver al repositorio
        </Link>
        <button
          onClick={handleTrash}
          disabled={trash.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {trash.isPending ? 'Moviendo…' : 'Mover a papelera'}
        </button>
      </div>

      <header className="bg-white rounded-xl shadow-sm p-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-900 break-all">{doc.name}</h1>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 mt-3 text-sm text-slate-600">
          <p>Formato: <span className="uppercase">{doc.format}</span></p>
          <p>Tamaño: {(doc.sizeBytes / 1024).toFixed(0)} KB</p>
          <p>Origen: {doc.source === 'GOOGLE_DRIVE' ? 'Google Drive' : 'Carga directa'}</p>
          <p>Fecha del documento: {fmtDate(doc.documentDate)}</p>
          <p>Ingreso: {fmtDate(doc.uploadedAt)}</p>
          <p>Cargado por: {doc.uploadedBy}</p>
        </div>
      </header>

      {/* HU01 — Clasificación */}
      <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Asociación al Criterio 9</h2>
          {!hasValidated && (
            <button
              onClick={() => classify.mutate(id)}
              disabled={classify.isPending}
              className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {classify.isPending ? 'Analizando…' : 'Clasificar con propuesta automática'}
            </button>
          )}
        </div>

        {classifyResult && !classifyResult.relevant && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
            {classifyResult.justification}
          </div>
        )}

        {doc.associations.length === 0 && !classifyResult && (
          <p className="text-sm text-slate-500">
            Aún no se ha generado una propuesta. Use "Clasificar" para analizar el documento.
          </p>
        )}

        <div className="space-y-4">
          {doc.associations.map((a) => (
            <div key={a.id} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {a.subcriterion.code} · {a.subcriterion.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    Estado: <span className="font-medium">{STATUS_LABEL[a.status]}</span>
                    {a.confidence ? ` · confianza ${Math.round(a.confidence * 100)}%` : ''}
                  </p>
                </div>
                {a.status === 'PROPOSED' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => action.mutate({ associationId: a.id, action: 'validate', documentId: id })}
                      disabled={action.isPending}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                    >
                      {action.isPending ? 'Guardando…' : 'Validar'}
                    </button>
                    <button
                      onClick={() => action.mutate({ associationId: a.id, action: 'reject', documentId: id })}
                      disabled={action.isPending}
                      className="rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                    >
                      Descartar
                    </button>
                  </div>
                )}
              </div>

              {a.justification && (
                <p className="mt-3 text-sm text-slate-600">{a.justification}</p>
              )}
              {a.evidenceFragment && (
                <blockquote className="mt-2 border-l-4 border-brand-200 pl-3 text-xs italic text-slate-500">
                  "{a.evidenceFragment}"
                </blockquote>
              )}
              {a.validatedBy && (
                <p className="mt-2 text-xs text-emerald-700">
                  Validada por {a.validatedBy} el {fmtDate(a.validatedAt)}
                </p>
              )}

              {a.history.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-slate-500 cursor-pointer">
                    Historial ({a.history.length})
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-slate-500">
                    {a.history.map((h, i) => (
                      <li key={i}>
                        {ACTION_LABEL[h.action]} — {h.user} · {fmtDate(h.at)}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>
      </section>

      {doc.textPreview && (
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-2">Texto extraído (vista previa)</h2>
          <pre className="text-xs text-slate-500 whitespace-pre-wrap max-h-64 overflow-auto">
            {doc.textPreview}
          </pre>
        </section>
      )}
    </div>
  );
}
