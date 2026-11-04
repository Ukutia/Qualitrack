import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useCreateDocumentRequest,
  useDocumentRequestAction,
  useDocumentRequests,
  useDeleteDocumentRequest,
} from '../hooks/useApi.js';
import { usePermission } from '../hooks/usePermission.js';
import { MODULES } from '../lib/permissions.js';
import ReadOnlyNotice from '../components/ReadOnlyNotice.jsx';

const STATUS = {
  PENDING: { label: 'Pendiente', classes: 'bg-amber-50 text-amber-800 ring-amber-200' },
  PAUSED: { label: 'Pausada', classes: 'bg-sky-50 text-sky-800 ring-sky-200' },
  CANCELLED: { label: 'Cancelada', classes: 'bg-steel-100 text-steel-600 ring-steel-200' },
  RECEIVED: { label: 'Recibida', classes: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
};

const EMAIL_TYPE = {
  INITIAL: 'Envío inicial',
  REMINDER: 'Recordatorio',
  RESUMED: 'Reanudación',
};

const EMAIL_STATUS = {
  PENDING: { label: 'En cola', classes: 'bg-amber-50 text-amber-800' },
  SENDING: { label: 'Enviando', classes: 'bg-sky-50 text-sky-800' },
  SENT: { label: 'Enviado', classes: 'bg-emerald-50 text-emerald-800' },
  FAILED: { label: 'Fallido', classes: 'bg-red-50 text-red-700' },
  CANCELLED: { label: 'Cancelado', classes: 'bg-steel-100 text-steel-600' },
};

function formatDate(value) {
  if (!value) return '—';
  return `${new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: false,
    timeZone: 'UTC',
  }).format(new Date(value))} UTC`;
}

function formatDays(value) {
  const days = Number(value);
  if (!Number.isFinite(days)) return '—';
  return `${days.toLocaleString('es-CL')} ${days === 1 ? 'día' : 'días'}`;
}

function errorMessage(error) {
  return error?.response?.data?.error || 'No fue posible completar la operación.';
}

function formatSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value)) return '—';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toLocaleString('es-CL', { maximumFractionDigits: 1 })} MB`;
}

function EyeIcon({ hidden }) {
  return hidden ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.8 10.8 0 0 1 12 4c5.3 0 9 5.1 9 5.1a15.8 15.8 0 0 1-3 3.7M6.2 6.2C4.1 7.7 3 9.1 3 9.1S6.7 14.2 12 14.2c.7 0 1.4-.1 2-.3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <path d="M3 12s3.7-5.2 9-5.2 9 5.2 9 5.2-3.7 5.2-9 5.2S3 12 3 12Z" /><circle cx="12" cy="12" r="2.4" />
    </svg>
  );
}

function CurrentToken({ token, createdAt }) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  if (!token) return <p className="mt-2 text-sm text-steel-500">No existe un token vigente.</p>;

  const publicUrl = `${window.location.origin}/document-request/${encodeURIComponent(token)}`;
  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mt-2 space-y-3">
      <div className="flex min-w-0 items-center gap-2">
        <code className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm ${visible ? 'text-ink-900' : 'select-none tracking-widest text-steel-500'}`}>
          {visible ? token : '••••••••••••••••••••••••'}
        </code>
        <button type="button" data-onboarding-key="mostrar-token" onClick={() => setVisible((current) => !current)} aria-pressed={visible} className="btn inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-steel-300 bg-white px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-steel-50">
          <EyeIcon hidden={!visible} /> {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-steel-200 pt-3">
        <button type="button" data-onboarding-key="copiar-link" onClick={copyLink} className="btn rounded-lg border border-steel-300 bg-white px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-steel-50">
          {copied ? 'Link copiado' : 'Copiar link'}
        </button>
        {visible && <a href={publicUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-700 hover:underline">Abrir link público ↗</a>}
      </div>
      <span className="sr-only">Token generado: {formatDate(createdAt)}</span>
    </div>
  );
}

function DocumentAssociation({ document }) {
  if (!document) return null;
  const content = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h5M9.5 13h5M9.5 16h5" /></svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="document-association-status block text-xs font-medium uppercase tracking-wide text-emerald-700">Documento recibido</span>
        <span className="document-association-name mt-0.5 block truncate text-sm font-semibold text-ink-900">{document.originalName}</span>
        <span className="document-association-meta mt-0.5 block text-xs text-steel-500">{String(document.format || '').toUpperCase()} · {formatSize(document.sizeBytes)} · {formatDate(document.uploadedAt)}</span>
      </span>
      {!document.deletedAt && <span className="document-association-action shrink-0 text-sm font-medium text-brand-700">Ver documento →</span>}
    </>
  );

  const classes = 'document-association mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-left';
  return document.deletedAt ? (
    <div data-onboarding-key="documento-asociado" className={classes}>{content}<span className="shrink-0 rounded-full bg-steel-200 px-2 py-1 text-xs text-steel-600">En papelera</span></div>
  ) : (
    <Link to={`/documents/${document.id}`} data-onboarding-key="documento-asociado" className={`${classes} document-association-link transition hover:border-emerald-300 hover:bg-emerald-50`} onClick={(event) => event.stopPropagation()}>{content}</Link>
  );
}

function requestSteps(request) {
  const sentEmail = request.emails?.find((email) => email.status === 'SENT' && email.sentAt);
  const lastEmail = request.emails?.[request.emails.length - 1];
  const second = sentEmail ? {
    label: 'Enlace enviado',
    detail: `${EMAIL_TYPE[sentEmail.type] || 'Correo'} · token v${sentEmail.tokenVersion}`,
    date: sentEmail.sentAt,
    state: 'done',
  } : lastEmail?.status === 'FAILED' ? {
    label: 'Enlace aún no enviado',
    detail: 'Qualitrack tuvo un problema. Intentaremos nuevamente.',
    date: lastEmail.lastAttemptAt,
    state: 'error',
  } : {
    label: 'Enlace por enviar',
    detail: lastEmail ? (EMAIL_STATUS[lastEmail.status]?.label || 'En proceso') : 'Sin envío registrado',
    date: lastEmail?.createdAt,
    state: 'current',
  };

  const finalByStatus = {
    RECEIVED: { label: 'Documento enviado', detail: request.document?.originalName || 'Entrega recibida', date: request.document?.uploadedAt || request.updatedAt, state: 'done' },
    CANCELLED: { label: 'Solicitud cancelada', detail: 'El enlace dejó de estar vigente', date: request.updatedAt, state: 'cancelled' },
    PAUSED: { label: 'Solicitud pausada', detail: 'El enlace está temporalmente inactivo', date: request.updatedAt, state: 'current' },
    PENDING: { label: 'Esperando documento', detail: 'El destinatario aún puede responder', date: null, state: 'waiting' },
  };

  return [
    { label: 'Solicitud creada', detail: `Solicitud #${request.id}`, date: request.createdAt, state: 'done' },
    second,
    finalByStatus[request.status] || finalByStatus.PENDING,
  ];
}

function RequestTimeline({ request }) {
  const steps = requestSteps(request);
  const pointClasses = {
    done: 'border-emerald-600 bg-emerald-600 text-white',
    error: 'border-red-500 bg-red-50 text-red-700',
    cancelled: 'border-steel-500 bg-steel-500 text-white',
    current: 'border-brand-600 bg-brand-50 text-brand-700',
    waiting: 'border-steel-300 bg-white text-steel-500',
  };

  return (
    <div data-onboarding-key="recorrido" className="relative">
      <div aria-hidden="true" className="absolute bottom-0 left-[0.95rem] top-4 w-px bg-steel-200 sm:bottom-auto sm:left-[16.66%] sm:right-[16.66%] sm:top-4 sm:h-px sm:w-auto" />
      <ol className="relative grid gap-5 sm:grid-cols-3 sm:gap-3" aria-label="Seguimiento de la solicitud">
        {steps.map((step, index) => (
          <li key={step.label} className="relative flex gap-3 sm:block sm:text-center">
            <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${pointClasses[step.state]}`}>
              {step.state === 'done' ? '✓' : index + 1}
            </span>
            <div className="min-w-0 sm:mt-3">
              <p className="text-sm font-semibold text-ink-900">{step.label}</p>
              <p className="mt-1 text-xs leading-5 text-steel-600">{step.detail}</p>
              <time className="mt-1 block text-xs font-medium tabular-nums text-steel-500" dateTime={step.date || undefined}>{formatDate(step.date)}</time>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function EmailHistory({ emails = [] }) {
  if (!emails.length) return <p className="text-sm text-steel-500">Todavía no hay envíos de correo registrados.</p>;
  return (
    <ul className="divide-y divide-steel-100">
      {emails.map((email) => {
        const status = EMAIL_STATUS[email.status] || EMAIL_STATUS.PENDING;
        return (
          <li key={email.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div>
              <p className="font-medium text-ink-900">{EMAIL_TYPE[email.type] || email.type} · token v{email.tokenVersion}</p>
              <p className="mt-0.5 text-xs text-steel-500">{email.sentAt ? `Enviado ${formatDate(email.sentAt)}` : `Creado ${formatDate(email.createdAt)}`} · {email.attemptCount || 0} intento(s)</p>
              {email.status === 'FAILED' && (
                <p className="mt-1 text-xs leading-5 text-red-700">
                  Esto es un problema de Qualitrack, no tuyo. Intentaremos nuevamente; también puedes volver más tarde.
                </p>
              )}
            </div>
            <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${status.classes}`}>{status.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function DocumentRequests() {
  const requests = useDocumentRequests();
  const action = useDocumentRequestAction();
  const deleteRequest = useDeleteDocumentRequest();
  const [actionError, setActionError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  // Con solo lectura se ven las solicitudes, pero no se crean ni cambian (HU19).
  const { canWrite } = usePermission(MODULES.SOLICITUDES);

  async function runAction(request, nextAction) {
    const warning = {
      pause: 'Al pausar, el token vigente se invalidará inmediatamente. No habrá rotaciones hasta que reanudes la solicitud.',
      resume: 'Al reanudar, se generará un token nuevo y la periodicidad comenzará nuevamente desde este momento.',
      cancel: 'Al cancelar, el token vigente se invalidará inmediatamente y la solicitud no podrá reanudarse.',
    }[nextAction];
    if (!window.confirm(warning)) return;

    setActionError('');
    try {
      await action.mutateAsync({ id: request.id, action: nextAction });
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }

  async function removeRequest(request) {
    const documentNote = request.document
      ? ' El documento recibido permanecerá en el repositorio.'
      : ' Si el enlace está vigente, dejará de funcionar inmediatamente.';
    if (!window.confirm(`Esta solicitud y su historial de correos se eliminarán permanentemente.${documentNote} ¿Deseas continuar?`)) return;
    setActionError('');
    try {
      await deleteRequest.mutateAsync(request.id);
      setExpandedId((current) => current === request.id ? null : current);
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">Solicitudes de documentos</h1>
          <p className="mt-2 text-sm text-steel-500">Sigue cada solicitud desde su creación hasta la entrega del documento.</p>
        </div>
        {canWrite && <Link to="/requests/new" className="btn inline-flex items-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">Crear solicitud</Link>}
      </header>

      {!canWrite && <ReadOnlyNotice />}

      {actionError && <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{actionError}</div>}

      {requests.isLoading ? (
        <div className="rounded-xl2 bg-white p-8 text-center text-sm text-steel-500 shadow-soft">Cargando solicitudes…</div>
      ) : requests.isError ? (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{errorMessage(requests.error)}</div>
      ) : !requests.data?.length ? (
        <div className="rounded-xl2 bg-white p-8 text-center shadow-soft ring-1 ring-steel-200/70">
          <p className="font-medium text-ink-900">Todavía no hay solicitudes.</p>
          <p className="mt-1 text-sm text-steel-500">Crea una para comprobar la generación y rotación de tokens.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.data.map((request) => {
            const status = STATUS[request.status] || STATUS.CANCELLED;
            const expanded = expandedId === request.id;
            return (
              <article
                key={request.id}
                data-onboarding-key="tarjeta-solicitud"
                className={`rounded-xl2 bg-white p-5 shadow-soft ring-1 transition ${expanded ? 'ring-2 ring-brand-300' : 'ring-steel-200/70 hover:ring-brand-200'}`}
                onClick={(event) => {
                  if (event.target.closest('a, button, input, textarea, select')) return;
                  setExpandedId(expanded ? null : request.id);
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-ink-900">{request.recipientEmail}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${status.classes}`}>{status.label}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-steel-700">{request.description}</p>
                    {request.createdBy?.name && <p className="mt-2 text-xs text-steel-500">Creada por {request.createdBy.name}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-steel-500">Solicitud #{request.id}</span>
                    <button type="button" data-onboarding-key="ver-recorrido" onClick={() => setExpandedId(expanded ? null : request.id)} aria-expanded={expanded} aria-controls={`request-details-${request.id}`} className="btn inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50">
                      {expanded ? 'Ocultar detalle' : 'Ver recorrido'}
                      <svg viewBox="0 0 20 20" aria-hidden="true" className={`h-4 w-4 fill-none stroke-current transition ${expanded ? 'rotate-180' : ''}`} strokeWidth="1.8"><path d="m5 7.5 5 5 5-5" /></svg>
                    </button>
                  </div>
                </div>

                <DocumentAssociation document={request.document} />

                {expanded && (
                  <section id={`request-details-${request.id}`} className="mt-5 space-y-5 border-t border-steel-200 pt-5" onClick={(event) => event.stopPropagation()}>
                    <div>
                      <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-steel-500">Recorrido de la solicitud</p>
                      <RequestTimeline request={request} />
                    </div>

                    <dl className="grid gap-3 rounded-xl bg-steel-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
                      <div><dt className="text-xs text-steel-500">Destinatario</dt><dd className="mt-1 break-all font-medium text-ink-900">{request.recipientEmail}</dd></div>
                      <div><dt className="text-xs text-steel-500">Creada por</dt><dd className="mt-1 font-medium text-ink-900">{request.createdBy?.name || 'Usuario de Qualitrack'}</dd></div>
                      <div><dt className="text-xs text-steel-500">Creada</dt><dd className="mt-1 font-medium text-ink-900">{formatDate(request.createdAt)}</dd></div>
                      <div><dt className="text-xs text-steel-500">Última actualización</dt><dd className="mt-1 font-medium text-ink-900">{formatDate(request.updatedAt)}</dd></div>
                      <div><dt className="text-xs text-steel-500">Correos registrados</dt><dd className="mt-1 font-medium text-ink-900">{request.emails?.length || 0}</dd></div>
                    </dl>

                    <details className="group overflow-hidden rounded-xl border border-steel-200 bg-white">
                      <summary data-onboarding-key="enlace-recordatorios" className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-ink-900 transition hover:bg-steel-50 [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8"><path d="M8 11V8a4 4 0 0 1 8 0v3M6 11h12v9H6z" /></svg>
                          </span>
                          <span>
                            <span className="block">Enlace y recordatorios</span>
                            <span className="mt-0.5 block text-xs font-normal text-steel-500">Configuración de entrega y acceso público</span>
                          </span>
                        </span>
                        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 fill-none stroke-current text-steel-500 transition group-open:rotate-180" strokeWidth="1.8"><path d="m5 7.5 5 5 5-5" /></svg>
                      </summary>

                      <div className="space-y-4 border-t border-steel-200 bg-steel-50/50 p-4">
                        <dl className="grid gap-3 text-sm sm:grid-cols-3">
                          <div><dt className="text-steel-500">Frecuencia</dt><dd className="mt-1 font-medium text-ink-900">{formatDays(request.reminderIntervalDays)}</dd></div>
                          <div><dt className="text-steel-500">Próxima rotación</dt><dd className="mt-1 font-medium text-ink-900">{formatDate(request.nextReminderAt)}</dd></div>
                          <div><dt className="text-steel-500">Versión del token</dt><dd className="mt-1 font-medium text-ink-900">v{request.tokenVersion}</dd></div>
                        </dl>

                        <div className="rounded-lg bg-white p-3 ring-1 ring-steel-200">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-medium uppercase tracking-wide text-steel-500">Token vigente</span>
                            <span className="text-xs text-steel-500">Generado: {formatDate(request.tokenCreatedAt)}</span>
                          </div>
                          <CurrentToken token={request.token} createdAt={request.tokenCreatedAt} />
                        </div>
                      </div>
                    </details>

                    <div data-onboarding-key="historial-envios">
                      <h3 className="text-sm font-semibold text-ink-900">Historial de enlaces enviados</h3>
                      <div className="mt-2 rounded-xl border border-steel-200 px-4"><EmailHistory emails={request.emails} /></div>
                    </div>
                  </section>
                )}

                {canWrite && <div className="mt-4 flex flex-wrap gap-2">
                  {request.status === 'PENDING' && <button type="button" disabled={action.isPending} onClick={() => runAction(request, 'pause')} className="btn rounded-lg border border-steel-300 px-3 py-2 text-sm font-medium text-ink-900 hover:bg-steel-50 disabled:opacity-50">Pausar</button>}
                  {request.status === 'PAUSED' && <button type="button" disabled={action.isPending} onClick={() => runAction(request, 'resume')} className="btn rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">Reanudar</button>}
                  {['PENDING', 'PAUSED'].includes(request.status) && <button type="button" disabled={action.isPending} onClick={() => runAction(request, 'cancel')} className="btn rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Cancelar</button>}
                  <button type="button" disabled={deleteRequest.isPending} onClick={() => removeRequest(request)} className="btn rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50">Eliminar</button>
                </div>}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NewDocumentRequest() {
  const navigate = useNavigate();
  const createRequest = useCreateDocumentRequest();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [description, setDescription] = useState('');
  const [days, setDays] = useState('7');
  const [formError, setFormError] = useState('');
  const daysValue = Number(days);
  const validDays = Number.isInteger(daysValue) && daysValue >= 1 && daysValue <= 30;

  async function submit(event) {
    event.preventDefault();
    setFormError('');
    try {
      await createRequest.mutateAsync({ recipientEmail, description, reminderIntervalDays: daysValue });
      navigate('/requests');
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <div className="w-full space-y-6">
      <header>
        <Link to="/requests" className="text-sm font-medium text-brand-600 hover:text-brand-700">← Volver a solicitudes</Link>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink-900">Crear solicitud</h1>
        <p className="mt-2 text-sm text-steel-500">Solicita la evidencia que necesitas y define cuándo recordar su entrega.</p>
      </header>

      <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.42fr)]">
      <form onSubmit={submit} className="space-y-5 rounded-xl2 bg-white p-6 shadow-soft ring-1 ring-steel-200/70 sm:p-7">
        <div className="border-b border-steel-100 pb-4"><h2 className="font-display text-xl font-semibold text-ink-900">Datos de la solicitud</h2><p className="mt-1 text-xs text-steel-600">Completa los tres campos para crear la solicitud.</p></div>
        {formError && <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{formError}</div>}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="min-w-0 space-y-2">
          <label htmlFor="request-recipient" className="block text-sm font-medium text-ink-900">Correo del destinatario</label>
          <input id="request-recipient" type="email" required maxLength={254} autoComplete="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="nombre@institucion.cl" className="w-full rounded-lg border border-steel-300 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-steel-400 focus:border-brand-500" />
          <p className="text-xs leading-5 text-steel-600">Correo de la persona a quien solicitas el documento.</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="request-frequency" className="block text-sm font-medium text-ink-900">Recordatorio (días)</label>
          <input id="request-frequency" type="number" required min="1" max="30" step="1" value={days} onChange={(event) => setDays(event.target.value)} className="w-full rounded-lg border border-steel-300 bg-white px-3 py-2.5 text-sm text-ink-900" />
          <p className="text-xs leading-5 text-steel-600">Entre 1 y 30 días.</p>
        </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="request-description" className="block text-sm font-medium text-ink-900">Descripción del documento</label>
          <textarea id="request-description" rows={5} required minLength={3} maxLength={2000} aria-describedby="request-description-help" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Por ejemplo: Política de aseguramiento de la calidad vigente, con su resolución de aprobación." className="w-full rounded-lg border border-steel-300 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-steel-400 focus:border-brand-500" />
          <div className="flex justify-between gap-3 text-xs text-steel-600"><p id="request-description-help">Indica qué documento necesitas y sus características.</p><span className="shrink-0 tabular-nums">{description.length}/2000</span></div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-steel-200 pt-5">
          <Link to="/requests" className="rounded-lg px-4 py-2.5 text-sm font-medium text-steel-700 hover:bg-steel-50">Volver</Link>
          <button type="submit" disabled={createRequest.isPending || !validDays} className="btn rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{createRequest.isPending ? 'Creando…' : 'Crear solicitud'}</button>
        </div>
      </form>
      <aside className="rounded-xl2 bg-white p-5 shadow-soft ring-1 ring-steel-200/60"><p className="text-xs font-medium uppercase tracking-wider text-brand-700">Después de crearla</p><h2 className="mt-3 font-display text-xl font-semibold text-ink-900">Una entrega más ordenada</h2><ul className="mt-4 space-y-4 text-sm leading-6 text-steel-600"><li>Se genera un enlace para recibir el documento solicitado.</li><li>Podrás copiar el enlace desde la lista de solicitudes.</li><li>Desde esa lista también podrás consultar el estado, pausar o cancelar la solicitud.</li></ul><div className="mt-5 rounded-xl bg-brand-50 p-3 text-xs leading-5 text-brand-800">Recordatorio: cada <strong>{validDays ? daysValue : '—'} días</strong>. Puedes elegir un intervalo entre 1 y 30 días.</div></aside>
      </div>
    </div>
  );
}
