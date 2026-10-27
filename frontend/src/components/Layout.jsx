import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import fullLogoDark from '../assets/fulllogo_darkmode.svg';
import { roleLabel } from '../lib/roles.js';
import { navFor } from '../lib/permissions.js';
import AnalysisWatcher from './AnalysisWatcher.jsx';
import NavigationIcon from './NavigationIcon.jsx';
import AppearanceSettings from './AppearanceSettings.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('qualitrack_sidebar_collapsed') === 'true'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('qualitrack_sidebar_collapsed', String(collapsed)); } catch { /* Navigation also works without storage. */ }
  }, [collapsed]);
  // Los módulos denegados no aparecen en el menú (HU19).
  const nav = navFor(user);

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
        aria-label="Navegación lateral"
        className={`relative shrink-0 flex flex-col text-steel-300 bg-ink-900 bg-gradient-to-b from-ink-800 to-ink-900 overflow-hidden transition-[width] duration-200 motion-reduce:transition-none ${collapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Hairline dorado que separa el lienzo institucional del contenido */}
        <span className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-gold-500/40 to-transparent" />

        <div className={`shrink-0 ${collapsed ? 'px-3 py-4' : 'px-4 pt-4 pb-5'}`}>
          <div className={`flex items-center gap-3 ${collapsed ? 'flex-col' : ''}`}>
            {collapsed ? <img src={`${import.meta.env.BASE_URL}favico_darkmode.svg`} alt="Qualitrack" title="Qualitrack" className="h-10 w-10 object-contain" /> : <img src={fullLogoDark} alt="Qualitrack" className="min-w-0 flex-1 h-auto" />}
            <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'} title={collapsed ? 'Expandir menú' : 'Contraer menú'} aria-expanded={!collapsed} aria-controls="main-sidebar-nav" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-steel-400 transition-colors hover:bg-white/10 hover:text-steel-100">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /><path d={collapsed ? 'm13 9 3 3-3 3' : 'm16 9-3 3 3 3'} /></svg>
            </button>
          </div>
          {!collapsed && <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-gold-400/80">
            Acreditación CNA
          </p>}
        </div>

        {!collapsed && <p className="shrink-0 px-4 pb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-steel-500">
          Criterio 9 · 3 niveles
        </p>}
        <nav id="main-sidebar-nav" aria-label="Menú principal" className={`sidebar-navigation min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1 space-y-1 ${collapsed ? 'sidebar-navigation-compact px-2' : 'px-3'}`}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors duration-200 ${collapsed ? 'justify-center px-2' : 'px-4'} ${
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
                  <NavigationIcon name={item.to} />
                  {!collapsed && <span>{item.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={`shrink-0 rounded-xl bg-white/[0.04] ring-1 ring-white/5 ${collapsed ? 'm-2 p-2' : 'm-3 p-3'}`}>
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <span title={collapsed ? `${user?.name} · ${roleLabel(user?.role)}` : undefined} aria-label={collapsed ? user?.name : undefined} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/30 text-xs font-semibold text-brand-100 ring-1 ring-white/10">
              {initials}
            </span>
            {!collapsed && <div className="min-w-0">
              <p className="truncate text-sm font-medium text-steel-100">{user?.name}</p>
              <p className="truncate text-xs text-steel-500">{user?.email}</p>
              <p className="mt-1 truncate text-[10px] font-medium uppercase tracking-[0.14em] text-gold-400/80">
                {roleLabel(user?.role)}
              </p>
            </div>}
          </div>
          <div className={`mt-3 flex items-center gap-1 ${collapsed ? 'flex-col' : ''}`}>
          <button
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            title={collapsed ? 'Cerrar sesión' : undefined}
            className="btn flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-white/5 hover:bg-white/10 px-2 py-2 text-xs font-medium text-steel-300 hover:text-steel-100"
          >
            <NavigationIcon name={collapsed ? 'power' : 'logout'} className={collapsed ? 'h-5 w-5' : 'h-4 w-4'} />
            {!collapsed && 'Cerrar sesión'}
          </button>
          <AppearanceSettings />
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto">
        <div className={`mx-auto w-full px-6 pt-10 pb-14 sm:px-8 lg:px-12 transition-[max-width] duration-200 motion-reduce:transition-none ${collapsed ? 'max-w-[1440px]' : 'max-w-7xl'}`}>
          <Outlet />
        </div>
      </main>
      <AnalysisWatcher />
    </div>
  );
}
