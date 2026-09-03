import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  useDocument,
  useClassify,
  useAssociationAction,
  useTrashDocument,
  useReassignAssociation,
  useCriterion,
} from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../lib/roles.js';

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
  const reassign = useReassignAssociation();
  const { data: criterion } = useCriterion();
  const { user } = useAuth();
  const [manualSub, setManualSub] = useState('');

  // La papelera es exclusiva del administrador (EP 1.2).
  const canTrash = user?.role === ROLES.ADMIN;

  if (isLoading) return <p className="text-steel-500">Cargando documento…</p>;
  if (!doc) return <p className="text-rose-600">Documento no encontrado.</p>;

  const classifyResult = classify.data;
  const hasValidated = doc.associations.some((a) => a.status === 'VALIDATED');
  const canManage = user?.role === ROLES.ADMIN || doc.uploadedById === user?.id;
  // La clasificación depende exclusivamente de la IA (sin respaldo por keywords):
  // si falla, se muestra el mensaje devuelto por el backend.
  const classifyError = classify.isError
    ? classify.error?.response?.data?.error ||
      'No se pudo generar la propuesta automática: el servicio de IA no está disponible. ' +
        'Inténtelo nuevamente en unos minutos.'
    : null;

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
        {canTrash && (
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
        )}
      </div>

      <header className="bg-white rounded-xl shadow-sm p-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-900 break-all">{doc.name}</h1>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 mt-3 text-sm text-steel-600">
          <p>Formato: <span className="uppercase">{doc.format}</span></p>
          <p>Tamaño: {(doc.sizeBytes / 1024).toFixed(0)} KB</p>
          <p>Origen: {doc.source === 'GOOGLE_DRIVE' ? 'Google Drive' : 'Carga directa'}</p>
          <p>Fecha del documento: {fmtDate(doc.documentDate)}
            {doc.documentDate && (
              <span className="ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 bg-steel-100 text-steel-400 font-medium">
                detectada automáticamente
              </span>
            )}
          </p>
          <p>Ingreso: {fmtDate(doc.uploadedAt)}</p>
          <p>Cargado por: {doc.uploadedBy}</p>
        </div>
      </header>

      {/* HU01 — Clasificación */}
      <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-steel-800">Asociación al Criterio 9</h2>
          {canManage && (
            <button
              onClick={() => classify.mutate(id)}
              disabled={classify.isPending}
              className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {classify.isPending
                ? 'Analizando…'
                : hasValidated
                  ? 'Volver a clasificar con IA'
                  : 'Clasificar con propuesta automática'}
            </button>
          )}
        </div>

        {classifyError && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex gap-3">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <p className="font-medium">Clasificación automática no disponible</p>
              <p className="mt-1">{classifyError}</p>
            </div>
          </div>
        )}

        {classifyResult && !classifyResult.relevant && (
          <div className="rounded-lg bg-steel-50 border border-steel-200 p-4 text-sm text-steel-600">
            {classifyResult.justification}
          </div>
        )}

        {doc.associations.length === 0 && !classifyResult && !classifyError && (
          <p className="text-sm text-steel-500">
            Aún no se ha generado una propuesta. Use “Clasificar” para analizar el documento.
          </p>
        )}

        <div className="space-y-4">
          {doc.associations.map((a) => (
            <div key={a.id} className="border border-steel-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-steel-800">
                    {a.subcriterion.code} · {a.subcriterion.name}
                  </p>
                  <p className="text-xs text-steel-500">
                    Estado: <span className="font-medium">{STATUS_LABEL[a.status]}</span>
                    {a.confidence ? ` · confianza ${Math.round(a.confidence * 100)}%` : ''}
                  </p>
                </div>
                {canManage && a.status === 'PROPOSED' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => action.mutate({ associationId: a.id, action: 'validate', documentId: id })}
                      disabled={action.isPending}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-medium"
                    >
                      Validar
                    </button>
                    <button
                      onClick={() => action.mutate({ associationId: a.id, action: 'reject', documentId: id })}
                      disabled={action.isPending}
                      className="rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 px-3 py-1.5 text-xs font-medium"
                    >
                      Descartar
                    </button>
                  </div>
                )}
              </div>

              {a.justification && (
                <p className="mt-3 text-sm text-steel-600">{a.justification}</p>
              )}
              {a.evidenceFragment && (
                <blockquote className="mt-2 border-l-4 border-brand-200 pl-3 text-xs italic text-steel-500">
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
                  <summary className="text-xs text-steel-500 cursor-pointer">
                    Historial ({a.history.length})
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-steel-500">
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

        {/* EP 1.2 — Reasignación manual cuando la propuesta de la IA no convence */}
        {canManage && <div className="border-t border-steel-200 pt-4">
          <p className="text-sm font-medium text-steel-700">Asignar el subcriterio manualmente</p>
          <p className="mt-1 text-xs text-steel-500">
            Elija el subcriterio correcto: la asociación quedará validada a su nombre y reemplazará
            cualquier asociación vigente o propuesta anterior.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={manualSub}
              onChange={(e) => setManualSub(e.target.value)}
              className="min-w-[22rem] rounded-lg border border-steel-300 bg-white px-3 py-2 text-sm text-steel-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            >
              <option value="">Seleccione un subcriterio…</option>
              {(criterion?.subcriteria || []).map((sub) => (
                <option key={sub.id} value={sub.id}>
                  Nivel {sub.level} · {sub.code} · {sub.name}
                </option>
              ))}
            </select>
            <button
              onClick={async () => {
                await reassign.mutateAsync({ documentId: id, subcriterionId: Number(manualSub) });
                setManualSub('');
              }}
              disabled={!manualSub || reassign.isPending}
              className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {reassign.isPending ? 'Guardando…' : 'Reasignar'}
            </button>
          </div>

          {reassign.isError && (
            <p className="mt-2 text-xs text-rose-600">
              {reassign.error?.response?.data?.error || 'No fue posible reasignar el subcriterio.'}
            </p>
          )}
        </div>}
      </section>

      {doc.textPreview && (
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-steel-800 mb-2">Texto extraído (vista previa)</h2>
          <pre className="text-xs text-steel-500 whitespace-pre-wrap max-h-64 overflow-auto">
            {doc.textPreview}
          </pre>
        </section>
      )}
    </div>
  );
}
