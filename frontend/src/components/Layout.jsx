import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import fullLogoDark from '../assets/fulllogo_darkmode.svg';
<<<<<<< Updated upstream

const NAV = [
  { to: '/app', label: 'Tablero', end: true },
  { to: '/documents', label: 'Repositorio' },
  { to: '/search', label: 'Búsqueda temática' },
  { to: '/upload', label: 'Cargar evidencia' },
  { to: '/structure', label: 'Estructura informe' },
  { to: '/report', label: 'Redacción informe' },
  { to: '/cloud', label: 'Google Drive' },
  { to: '/trash', label: 'Papelera' },
];
=======
import { navFor, roleLabel } from '../lib/roles.js';
>>>>>>> Stashed changes

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // Cada rol ve solo sus secciones (EP 1.1 · EP 1.2).
  const nav = navFor(user?.role);

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
        className="relative w-64 shrink-0 flex flex-col text-steel-300
                    bg-ink-900 bg-gradient-to-b from-ink-800 to-ink-900 overflow-y-auto"
      >
        {/* Hairline dorado que separa el lienzo institucional del contenido */}
        <span className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-gold-500/40 to-transparent" />

        <div className="px-6 pt-7 pb-6">
          <img src={fullLogoDark} alt="Qualitrack" className="w-full h-auto" />
          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-gold-400/80">
            Acreditación CNA
          </p>
        </div>

        <p className="px-6 pb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-steel-500">
          Criterio 9 · 3 niveles
        </p>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group relative flex items-center rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-white/[0.06] text-steel-50'
                    : 'text-steel-400 hover:bg-white/[0.04] hover:text-steel-100'
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
              <p className="truncate text-sm font-medium text-steel-100">{user?.name}</p>
              <p className="truncate text-xs text-steel-500">{user?.email}</p>
              <p className="mt-1 truncate text-[10px] font-medium uppercase tracking-[0.14em] text-gold-400/80">
                {roleLabel(user?.role)}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn mt-3 w-full rounded-lg bg-white/5 hover:bg-white/10 py-2 text-xs font-medium text-steel-300 hover:text-steel-100"
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
