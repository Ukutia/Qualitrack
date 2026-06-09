import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { to: '/', label: 'Tablero', end: true },
  { to: '/documents', label: 'Repositorio' },
  { to: '/upload', label: 'Cargar evidencia' },
  { to: '/structure', label: 'Estructura informe' },
  { to: '/cloud', label: 'Google Drive' },
];

function Logo() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-700 ring-1 ring-white/10 shadow-inset">
      <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true">
        <circle cx="16" cy="16" r="10" fill="none" stroke="#c9a368" strokeWidth="2" />
        <path
          d="M11 16.5l3.4 3.4L21 13"
          fill="none"
          stroke="#c9a368"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const initials = (user?.name || '?')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <div className="h-screen flex overflow-hidden">
      <aside
        className="relative w-64 shrink-0 flex flex-col text-stone-300
                   bg-ink-900 bg-gradient-to-b from-ink-800 to-ink-900 overflow-y-auto"
      >
        {/* Hairline dorado que separa el lienzo institucional del contenido */}
        <span className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-gold-500/40 to-transparent" />

        <div className="px-6 pt-7 pb-6">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-stone-50">
                Qualitrack
              </h1>
              <p className="text-[11px] uppercase tracking-[0.18em] text-gold-400/80">
                Acreditación CNA
              </p>
            </div>
          </div>
        </div>

        <p className="px-6 pb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-stone-500">
          Criterio 9
        </p>
        <nav className="flex-1 px-3 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group relative flex items-center rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-white/[0.06] text-stone-50'
                    : 'text-stone-400 hover:bg-white/[0.04] hover:text-stone-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-gold-400 transition-all duration-200 ${
                      isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
                    }`}
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="m-3 rounded-xl bg-white/[0.04] ring-1 ring-white/5 p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/30 text-xs font-semibold text-brand-100 ring-1 ring-white/10">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-stone-100">{user?.name}</p>
              <p className="truncate text-xs text-stone-500">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn mt-3 w-full rounded-lg bg-white/5 hover:bg-white/10 py-2 text-xs font-medium text-stone-300 hover:text-stone-100"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-8 pt-8 pb-14">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
