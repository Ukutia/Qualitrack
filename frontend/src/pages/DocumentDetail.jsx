import { useEffect, useState } from 'react';
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
import { isAnalysisInProgress, normalizeAnalysisStatus, ANALYSIS_PROGRESS_TEXT, describeEngine } from '../lib/analysisStatus.js';

const LAST_DOCUMENT_KEY = 'qualitrack_last_document_id';

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

  useEffect(() => {
    if (id) localStorage.setItem(LAST_DOCUMENT_KEY, String(id));
  }, [id]);

  useEffect(() => {
    if (!id) return undefined;

    const token = localStorage.getItem('qualitrack_token') || '';
    const streamUrl = `/api/documents/${id}/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(streamUrl);

    source.addEventListener('document-status', (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.id) {
          localStorage.setItem(LAST_DOCUMENT_KEY, String(payload.id));
        }
      } catch {
        // Ignorar payload inválido del stream sin romper la pantalla.
      }
    });

    return () => source.close();
  }, [id]);

  // La papelera es exclusiva del administrador (EP 1.2).
  const canTrash = user?.role === ROLES.ADMIN;

  if (isLoading) return <p className="text-steel-500">Cargando documento…</p>;

  // El estado llega en dos formas segun venga del REST o del SSE; se normaliza
  // antes de comparar para que la interfaz no dependa de cual de las dos llego.
  const estadoAnalisis = normalizeAnalysisStatus(doc?.analysisStatus);
  const analizando = isAnalysisInProgress(doc?.analysisStatus);
  const motor = describeEngine(doc?.analysisEngine);
  if (!doc) return <p className="text-rose-600">Documento no encontrado.</p>;

  const classifyResult = classify.data;
  const hasValidated = doc.associations.some((a) => a.status === 'VALIDATED');
  const canManage = user?.role === ROLES.ADMIN || doc.uploadedById === user?.id;
  const isVectorizing = doc.vectorizationStatus === 'PROCESSING';
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
        <span className="group relative inline-flex">
        <button
            onClick={handleTrash}
            disabled={trash.isPending || isVectorizing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {trash.isPending ? 'Moviendo…' : 'Mover a papelera'}
          </button>
          {isVectorizing && (
            <span className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-72 rounded-lg bg-ink-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg group-hover:block">
              No se puede eliminar todavía porque el documento se está preparando para las búsquedas.
            </span>
          )}
        </span>
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
          <p>Estado del análisis: <span className="font-medium text-steel-700">{doc.analysisStatus || 'recibido'}</span></p>
        </div>
        <div className="flex items-center gap-2">
            <span>Disponibilidad para búsquedas:</span>
            {isVectorizing ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" />
                Preparando documento…
              </span>
            ) : doc.vectorizationStatus === 'FAILED' ? (
              <span className="font-medium text-rose-600">Preparación pendiente</span>
            ) : (
              <span className="font-medium text-emerald-600">Disponible</span>
            )}
          </div>
      </header>

      {/* HU01 — Clasificación */}
      <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-steel-800">Asociación al Criterio 9</h2>
          {canManage && (
            <button
              onClick={() => classify.mutate(id)}
              disabled={classify.isPending || analizando}
              className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {classify.isPending || analizando
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

        {/* Mientras el analisis corre. El POST responde en milisegundos y el
            trabajo ocurre despues de forma asincrona, asi que el estado tiene
            que salir del documento, no de la respuesta de la mutacion. */}
        {analizando && (
          <div className="rounded-lg bg-brand-50 border border-brand-200 p-4 text-sm text-brand-800 flex gap-3 items-center">
            <svg className="h-5 w-5 shrink-0 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <div>
              <p className="font-medium">{ANALYSIS_PROGRESS_TEXT[estadoAnalisis] || 'Analizando…'}</p>
              <p className="mt-1 text-brand-700">
                El documento se procesa en el equipo local con IA propia; no sale a ningún servicio externo.
              </p>
            </div>
          </div>
        )}

        {/* Analisis terminado sin asociacion: la IA decidio que el documento no
            corresponde al Criterio 9. Antes esto se veia como un panel vacio,
            indistinguible de un documento nunca analizado. */}
        {!analizando && estadoAnalisis === 'COMPLETED' && doc.associations.length === 0 && (
          <div className="rounded-lg bg-steel-50 border border-steel-200 p-4 text-sm text-steel-600">
            <p className="font-medium text-steel-700">El análisis no propuso ningún subcriterio</p>
            <p className="mt-1">
              {doc.analysisSummary
                || 'El documento fue analizado y no se encontró correspondencia con el Criterio 9. Puede asignar un subcriterio manualmente si considera que sí aplica.'}
            </p>
            {motor && (
              <span className={`mt-3 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${motor.clases}`}>
                {motor.texto}
              </span>
            )}
          </div>
        )}

        {!analizando && estadoAnalisis !== 'COMPLETED' && doc.associations.length === 0 && !classifyError && (
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
                  {describeEngine(a.engine) && (
                    <span
                      title={describeEngine(a.engine).detalle || ''}
                      className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${describeEngine(a.engine).clases}`}
                    >
                      {describeEngine(a.engine).esIA ? (
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" strokeLinecap="round" />
                          <circle cx="12" cy="12" r="3.5" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {describeEngine(a.engine).texto}
                    </span>
                  )}
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
