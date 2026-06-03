import { useParams, Link } from 'react-router-dom';
import { useDocument, useClassify, useAssociationAction } from '../hooks/useApi.js';

const fmtDate = (d) => (d ? new Date(d).toLocaleString('es-CL') : '—');
const ACTION_LABEL = { PROPOSED: 'Propuesta generada', VALIDATED: 'Validada', REJECTED: 'Descartada' };
const STATUS_LABEL = { PROPOSED: 'Sin validar', VALIDATED: 'Validada', NOT_VALIDATED: 'Descartada' };

export default function DocumentDetail() {
  const { id } = useParams();
  const { data: doc, isLoading } = useDocument(id);
  const classify = useClassify();
  const action = useAssociationAction();

  if (isLoading) return <p className="text-slate-500">Cargando documento…</p>;
  if (!doc) return <p className="text-rose-600">Documento no encontrado.</p>;

  const classifyResult = classify.data;

  return (
    <div className="space-y-6">
      <Link to="/documents" className="text-sm text-brand-600 hover:underline">
        ← Volver al repositorio
      </Link>

      <header className="bg-white rounded-xl shadow-sm p-6">
        <h1 className="text-xl font-bold text-slate-800 break-all">{doc.name}</h1>
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
          <button
            onClick={() => classify.mutate(id)}
            disabled={classify.isPending}
            className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {classify.isPending ? 'Analizando…' : 'Clasificar con propuesta automática'}
          </button>
        </div>

        {classifyResult && !classifyResult.relevant && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
            {classifyResult.justification}
          </div>
        )}

        {doc.associations.length === 0 && !classifyResult && (
          <p className="text-sm text-slate-500">
            Aún no se ha generado una propuesta. Use “Clasificar” para analizar el documento.
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
                {(() => {
                  // Mientras la acción de ESTA asociación está en curso, sus
                  // botones se deshabilitan para evitar clics múltiples.
                  const busy = action.isPending && action.variables?.associationId === a.id;
                  const validate = () =>
                    action.mutate({ associationId: a.id, action: 'validate', docId: id });
                  const reject = () =>
                    action.mutate({ associationId: a.id, action: 'reject', docId: id });

                  if (a.status === 'VALIDATED') {
                    return (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={validate}
                          disabled={busy}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                        >
                          Re-validar
                        </button>
                        <button
                          onClick={reject}
                          disabled={busy}
                          className="rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                        >
                          Descartar
                        </button>
                      </div>
                    );
                  }
                  // Sin estado (PROPOSED): solo "Validar".
                  return (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={validate}
                        disabled={busy}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                      >
                        Validar
                      </button>
                    </div>
                  );
                })()}
              </div>

              {a.justification && (
                <p className="mt-3 text-sm text-slate-600">{a.justification}</p>
              )}
              {a.evidenceFragment && (
                <blockquote className="mt-2 border-l-4 border-brand-200 pl-3 text-xs italic text-slate-500">
                  “{a.evidenceFragment}”
                </blockquote>
              )}
              {a.validatedBy && (
                <p className="mt-2 text-xs text-emerald-700">
                  Validada por {a.validatedBy} el {fmtDate(a.validatedAt)}
                </p>
              )}

              {/* Historial de auditoría */}
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
