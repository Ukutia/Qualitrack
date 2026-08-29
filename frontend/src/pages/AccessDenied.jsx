import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { homeFor, roleLabel } from '../lib/roles.js';

/** Pantalla de "Acceso denegado" (EP 1.1 · EP 1.2). */
export default function AccessDenied() {
  const { user } = useAuth();
  const home = homeFor(user?.role);

  return (
    <div className="max-w-lg">
      <div className="bg-white rounded-xl shadow-sm p-8">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M6 6l12 12" strokeLinecap="round" />
          </svg>
        </span>

        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-ink-900">
          Acceso denegado
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-steel-600">
          Su rol <span className="font-medium text-steel-800">{roleLabel(user?.role)}</span> no tiene
          permisos sobre esta función. Si necesita acceder, solicítelo al administrador de la
          plataforma.
        </p>

        <Link
          to={home}
          className="btn mt-6 inline-flex rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 text-sm font-medium shadow-soft"
        >
          Volver a mi sección
        </Link>
      </div>
    </div>
  );
}
