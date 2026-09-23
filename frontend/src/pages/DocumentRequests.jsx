import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useCreateDocumentRequest,
  useDocumentRequestConfig,
  useDocumentRequestAction,
  useDocumentRequests,
} from '../hooks/useApi.js';

const STATUS = {
  PENDING: { label: 'Pendiente', classes: 'bg-amber-50 text-amber-800 ring-amber-200' },
  PAUSED: { label: 'Pausada', classes: 'bg-sky-50 text-sky-800 ring-sky-200' },
  CANCELLED: { label: 'Cancelada', classes: 'bg-steel-100 text-steel-600 ring-steel-200' },
  RECEIVED: { label: 'Recibida', classes: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
};
function formatDate(value) {
  return value ? new Date(value).toLocaleString('es-CL') : '—';
}

function errorMessage(error) {
  return error?.response?.data?.error || 'No fue posible completar la operación.';
}

function CurrentToken({ token, createdAt }) {
  const [copied, setCopied] = useState(false);
  if (!token) return <p className="mt-2 text-sm text-steel-500">No existe un token vigente.</p>;

  const publicUrl = `${window.location.origin}/document-request/${encodeURIComponent(token)}`;
  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mt-2 space-y-3">
      <code className="block break-all text-sm text-ink-900">{token}</code>
      <div className="border-t border-steel-200 pt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-steel-500">Link público vigente</p>
        <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm font-medium text-brand-700 hover:underline">
          {publicUrl}
        </a>
        <button type="button" onClick={copyLink} className="btn mt-2 rounded-lg border border-steel-300 bg-white px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-steel-50">
          {copied ? 'Link copiado' : 'Copiar link'}
        </button>
      </div>
      <span className="sr-only">Token generado: {formatDate(createdAt)}</span>
    </div>
  );
}

export default function DocumentRequests() {
  const requests = useDocumentRequests();
  const action = useDocumentRequestAction();
  const [actionError, setActionError] = useState('');

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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">Solicitudes de documentos</h1>
          <p className="mt-2 text-sm text-steel-500">Etapa de prueba del ciclo de vida y la rotación segura de tokens.</p>
        </div>
        <Link to="/requests/new" className="btn inline-flex items-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">Crear solicitud</Link>
      </header>

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
            return (
              <article key={request.id} className="rounded-xl2 bg-white p-5 shadow-soft ring-1 ring-steel-200/70">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-ink-900">{request.recipientEmail}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${status.classes}`}>{status.label}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-steel-700">{request.description}</p>
                  </div>
                  <span className="text-xs text-steel-500">Solicitud #{request.id}</span>
                </div>

                <dl className="mt-4 grid gap-3 border-t border-steel-100 pt-4 text-sm sm:grid-cols-3">
                  <div><dt className="text-steel-500">Frecuencia</dt><dd className="mt-1 font-medium text-ink-900">{request.reminderIntervalMinutes} min</dd></div>
                  <div><dt className="text-steel-500">Próxima rotación</dt><dd className="mt-1 font-medium text-ink-900">{formatDate(request.nextReminderAt)}</dd></div>
                  <div><dt className="text-steel-500">Versión del token</dt><dd className="mt-1 font-medium text-ink-900">v{request.tokenVersion}</dd></div>
                </dl>

                <div className="mt-4 rounded-lg bg-steel-50 p-3 ring-1 ring-steel-200">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium uppercase tracking-wide text-steel-500">Token vigente</span>
                    <span className="text-xs text-steel-500">Generado: {formatDate(request.tokenCreatedAt)}</span>
                  </div>
                  <CurrentToken token={request.token} createdAt={request.tokenCreatedAt} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {request.status === 'PENDING' && <button type="button" disabled={action.isPending} onClick={() => runAction(request, 'pause')} className="btn rounded-lg border border-steel-300 px-3 py-2 text-sm font-medium text-ink-900 hover:bg-steel-50 disabled:opacity-50">Pausar</button>}
                  {request.status === 'PAUSED' && <button type="button" disabled={action.isPending} onClick={() => runAction(request, 'resume')} className="btn rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">Reanudar</button>}
                  {['PENDING', 'PAUSED'].includes(request.status) && <button type="button" disabled={action.isPending} onClick={() => runAction(request, 'cancel')} className="btn rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Cancelar</button>}
                </div>
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
  const requestConfig = useDocumentRequestConfig();
  const allowSubdayIntervals = requestConfig.data?.allowSubdayIntervals === true;
  const minimumDays = requestConfig.data?.minimumIntervalDays ?? 1;
  const [recipientEmail, setRecipientEmail] = useState('');
  const [description, setDescription] = useState('');
  const [days, setDays] = useState('7');
  const [formError, setFormError] = useState('');
  const minutes = useMemo(() => {
    const value = Number(days);
    return Number.isFinite(value) ? Math.round(value * 1440) : 0;
  }, [days]);

  async function submit(event) {
    event.preventDefault();
    setFormError('');
    try {
      await createRequest.mutateAsync({ recipientEmail, description, reminderIntervalDays: Number(days) });
      navigate('/requests');
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <Link to="/requests" className="text-sm font-medium text-brand-600 hover:text-brand-700">← Volver a solicitudes</Link>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink-900">Crear solicitud</h1>
        <p className="mt-2 text-sm text-steel-500">La creación genera inmediatamente el primer token vigente.</p>
      </header>

      <form onSubmit={submit} className="space-y-6 rounded-xl2 bg-white p-6 shadow-soft ring-1 ring-steel-200/70">
        {formError && <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{formError}</div>}
        <div className="space-y-2">
          <label htmlFor="request-recipient" className="block text-sm font-medium text-ink-900">Correo del destinatario</label>
          <input id="request-recipient" type="email" required maxLength={254} autoComplete="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="nombre@institucion.cl" className="w-full rounded-lg border border-steel-300 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-steel-400 focus:border-brand-500" />
        </div>
        <div className="space-y-2">
          <label htmlFor="request-description" className="block text-sm font-medium text-ink-900">Descripción del documento</label>
          <textarea id="request-description" rows={4} required minLength={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe la evidencia que necesitas recibir" className="w-full rounded-lg border border-steel-300 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-steel-400 focus:border-brand-500" />
        </div>
        <div className="space-y-2 border-t border-steel-200 pt-5">
          <label htmlFor="request-frequency" className="block text-sm font-medium text-ink-900">Frecuencia del recordatorio (días)</label>
          <input id="request-frequency" type="number" required min={minimumDays} max="30" step={allowSubdayIntervals ? 'any' : 1} value={days} onChange={(event) => setDays(event.target.value)} className="w-44 rounded-lg border border-steel-300 bg-white px-3 py-2.5 text-sm text-ink-900" />
          <p className="text-sm font-medium text-brand-700">Equivale a {minutes > 0 ? `${minutes.toLocaleString('es-CL')} minuto${minutes === 1 ? '' : 's'}` : 'una frecuencia inválida'}.</p>
          <p className="text-xs text-steel-500">{allowSubdayIntervals ? 'Modo de prueba: mínimo 1 minuto. En producción real se recomienda exigir entre 1 y 30 días.' : 'Entre 1 y 30 días.'}</p>
        </div>
        <div className="border-t border-steel-200 pt-5">
          <button type="submit" disabled={createRequest.isPending || minutes < 1} className="btn rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{createRequest.isPending ? 'Creando…' : 'Crear solicitud y token'}</button>
        </div>
      </form>
    </div>
  );
}
