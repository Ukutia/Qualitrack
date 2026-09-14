import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function DocumentRequests() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">
          Solicitudes de documentos
        </h1>
        <p className="mt-2 text-sm text-steel-500">
          Solicita evidencias faltantes y programa recordatorios por correo para dar seguimiento a los documentos pendientes.
        </p>
      </header>
      <Link
        to="/requests/new"
        className="btn inline-flex items-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        Crear Solicitud
      </Link>
    </div>
  );
}

export function NewDocumentRequest() {
  const [sendReminders, setSendReminders] = useState(false);

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <Link to="/requests" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Volver a solicitudes
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink-900">
          Crear solicitud
        </h1>
        <p className="mt-2 text-sm text-steel-500">
          Indica a quién solicitar la evidencia y qué documento necesitas.
        </p>
      </header>

      <form onSubmit={(event) => event.preventDefault()} className="space-y-6 rounded-xl2 bg-white p-6 shadow-soft ring-1 ring-steel-200/70">
        <div className="space-y-2">
          <label htmlFor="request-recipient" className="block text-sm font-medium text-ink-900">
            Correo del destinatario
          </label>
          <input
            id="request-recipient"
            type="email"
            autoComplete="email"
            placeholder="nombre@institucion.cl"
            className="w-full rounded-lg border border-steel-300 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-steel-400 focus:border-brand-500"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="request-description" className="block text-sm font-medium text-ink-900">
            Descripción del documento
          </label>
          <textarea
            id="request-description"
            rows={4}
            placeholder="Describe la evidencia que necesitas recibir"
            className="w-full rounded-lg border border-steel-300 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-steel-400 focus:border-brand-500"
          />
        </div>

        <div className="space-y-4 border-t border-steel-200 pt-5">
          <label className="flex items-start gap-3 text-sm font-medium text-ink-900">
            <input
              type="checkbox"
              checked={sendReminders}
              onChange={(event) => setSendReminders(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-steel-300 accent-brand-600"
            />
            Programar recordatorios por correo
          </label>
          <p className="text-sm text-steel-500">
            {sendReminders
              ? 'Mientras la solicitud siga pendiente, se enviará un recordatorio con la frecuencia indicada.'
              : 'Si no activas los recordatorios, el correo de solicitud se enviará una sola vez.'}
          </p>
          <div className="space-y-2">
            <label htmlFor="request-frequency" className="block text-sm font-medium text-ink-900">
              Frecuencia del recordatorio (días)
            </label>
            <input
              id="request-frequency"
              type="number"
              min="1"
              max="30"
              step="1"
              defaultValue="7"
              disabled={!sendReminders}
              className="w-32 rounded-lg border border-steel-300 bg-white px-3 py-2.5 text-sm text-ink-900 disabled:bg-steel-100 disabled:text-steel-400"
            />
            <p className="text-xs text-steel-500">Entre 1 y 30 días.</p>
          </div>
        </div>

        <div className="border-t border-steel-200 pt-5">
          <button type="submit" disabled className="btn rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            Enviar Solicitud
          </button>
        </div>
      </form>
    </div>
  );
}
