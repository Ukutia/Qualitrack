import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { homeFor } from '../lib/roles.js';
import { LEVEL_ORDER, levelMeta } from '../lib/levels.js';
import fullLogo from '../assets/fulllogo.svg';
import fullLogoDark from '../assets/fulllogo_darkmode.svg';
import useDocumentMeta from '../lib/useDocumentMeta.js';
import AppearanceSettings from '../components/AppearanceSettings.jsx';

export default function Login() {
  useDocumentMeta({
    title: 'Acceso a la plataforma',
    description:
      'Ingresa a Qualitrack para gestionar la evidencia del Criterio 9 de tu institución.',
  });

  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Si ya hay sesión, redirige (en efecto, no durante el render).
  useEffect(() => {
    if (user) navigate(homeFor(user.role), { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full grid lg:grid-cols-[1.05fr_1fr]">
      {/* Lienzo institucional */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-ink-900 bg-gradient-to-br from-ink-800 via-ink-900 to-ink-900 p-12 text-steel-200">
        <span className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl" />
        <span className="pointer-events-none absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-gold-500/10 blur-3xl" />

        <div className="relative flex items-center">
          <img src={fullLogoDark} alt="Qualitrack" className="h-16 w-auto" />
        </div>

        <div className="relative max-w-md">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold-400/80">
            Acreditación CNA · Criterio 9
          </p>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight text-steel-50">
            La evidencia, en orden. La acreditación, bajo control.
          </h2>
          <p className="mt-4 text-steel-400 leading-relaxed">
            Gestión y resultados del aseguramiento interno de la calidad, organizado tal como lo
            evalúa la CNA: tres niveles acumulativos y sus subcriterios, con semáforos en tiempo real.
          </p>

          <ul className="mt-7 space-y-3">
            {LEVEL_ORDER.map((level) => {
              const meta = levelMeta(level);
              return (
                <li key={level} className="flex gap-3">
                  <span className="mt-1.5 h-6 shrink-0 rounded-full border-l-2 border-gold-400/60" />
                  <div>
                    <p className="text-sm font-semibold text-steel-200">
                      {meta.label} · {meta.title}
                    </p>
                    <p className="text-xs leading-relaxed text-steel-500">{meta.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative text-xs text-steel-500">© {new Date().getFullYear()} Qualitrack · Gestión de evidencias</p>
      </aside>

      {/* Formulario */}
      <div className="relative flex items-center justify-center px-6 pb-10 pt-24 sm:px-10">
        <div className="absolute right-6 top-6 flex items-center gap-2"><span className="text-xs text-steel-600">Apariencia</span><AppearanceSettings surface /></div>
        <form onSubmit={handleSubmit} className="card-drop-in w-full max-w-sm">
          <div className="lg:hidden mb-6 flex items-center">
            <img src={fullLogo} alt="Qualitrack" className="login-logo-light h-10 w-auto" />
            <img src={fullLogoDark} alt="Qualitrack" className="login-logo-dark hidden h-10 w-auto" />
          </div>

          <h1 className="font-display text-3xl font-semibold text-ink-900">Bienvenido de vuelta</h1>
          <p className="mt-1.5 text-sm text-steel-500">Ingresa para gestionar tus evidencias.</p>

          {error && (
            <div className="alert-in mt-5 rounded-lg bg-rose-50 text-rose-700 text-sm px-4 py-2.5 ring-1 ring-rose-100">
              {error}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-steel-700 mb-1.5">Correo electrónico</label>
              <div className="relative">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-steel-500"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 6 9 7 9-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <input
                type="email"
                id="login-email"
                autoComplete="username"
                placeholder="nombre@institucion.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-steel-300 bg-white/70 pl-11 pr-3.5 py-3 text-steel-800 placeholder:text-steel-500 transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none"
              />
              </div>
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-steel-700 mb-1.5">Contraseña</label>
              <div className="relative">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-steel-500"><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" strokeLinecap="round" /></svg>
              <input
                type={showPassword ? 'text' : 'password'}
                id="login-password"
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-steel-300 bg-white/70 pl-11 pr-12 py-3 text-steel-800 placeholder:text-steel-500 transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none"
              />
              <button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-controls="login-password" title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-md text-steel-600 hover:bg-steel-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showPassword && <path d="m3 3 18 18" />}</svg>
              </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn mt-6 w-full rounded-lg bg-brand-600 hover:bg-brand-700 text-white py-2.5 font-medium shadow-soft hover:shadow-lift disabled:opacity-60"
          >
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
