import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@qualitrack.cl');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Si ya hay sesión, redirige (en efecto, no durante el render).
  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full grid lg:grid-cols-[1.05fr_1fr]">
      {/* Lienzo institucional */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-ink-900 bg-gradient-to-br from-ink-800 via-ink-900 to-ink-900 p-12 text-stone-200">
        <span className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl" />
        <span className="pointer-events-none absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-gold-500/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10">
            <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
              <circle cx="16" cy="16" r="10" fill="none" stroke="#c9a368" strokeWidth="2" />
              <path d="M11 16.5l3.4 3.4L21 13" fill="none" stroke="#c9a368" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight text-stone-50">Qualitrack</span>
        </div>

        <div className="relative max-w-md">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold-400/80">
            Acreditación CNA · Criterio 9
          </p>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight text-stone-50">
            La evidencia, en orden. La acreditación, bajo control.
          </h2>
          <p className="mt-4 text-stone-400 leading-relaxed">
            Centraliza tus documentos, vigila el estado de cada subcriterio con semáforos en
            tiempo real y llega al informe sin sorpresas de última hora.
          </p>
        </div>

        <p className="relative text-xs text-stone-500">© {new Date().getFullYear()} Qualitrack · Gestión de evidencias</p>
      </aside>

      {/* Formulario */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <form onSubmit={handleSubmit} className="card-drop-in w-full max-w-sm">
          <div className="lg:hidden mb-6 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-900 ring-1 ring-black/5">
              <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
                <circle cx="16" cy="16" r="10" fill="none" stroke="#c9a368" strokeWidth="2" />
                <path d="M11 16.5l3.4 3.4L21 13" fill="none" stroke="#c9a368" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="font-display text-2xl font-semibold text-ink-900">Qualitrack</span>
          </div>

          <h1 className="font-display text-3xl font-semibold text-ink-900">Bienvenido de vuelta</h1>
          <p className="mt-1.5 text-sm text-stone-500">Ingresa para gestionar tus evidencias.</p>

          {error && (
            <div className="alert-in mt-5 rounded-lg bg-rose-50 text-rose-700 text-sm px-4 py-2.5 ring-1 ring-rose-100">
              {error}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white/70 px-3.5 py-2.5 text-stone-800 placeholder:text-stone-400 transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white/70 px-3.5 py-2.5 text-stone-800 transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn mt-6 w-full rounded-lg bg-brand-600 hover:bg-brand-700 text-white py-2.5 font-medium shadow-soft hover:shadow-lift disabled:opacity-60"
          >
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>

          <p className="mt-5 rounded-lg bg-stone-100/70 px-3 py-2 text-xs text-stone-500 ring-1 ring-stone-200/60">
            Credenciales por defecto · <span className="tnum">admin@qualitrack.cl</span> / admin123
          </p>
        </form>
      </div>
    </div>
  );
}
