import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_APPEARANCE } from '../lib/appearance.js';
import { useAppearance } from '../context/AppearanceContext.jsx';

function AppearanceIcon({ className = 'h-5 w-5' }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M4 7h4m4 0h8M4 17h8m4 0h4" /><circle cx="10" cy="7" r="2" /><circle cx="14" cy="17" r="2" /></svg>;
}

export default function AppearanceSettings({ surface = false }) {
  const { preferences, setPreferences } = useAppearance();
  const [open, setOpen] = useState(false);
  const dialog = useRef(null);
  const trigger = useRef(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const main = document.querySelector('main');
    const previousMainOverflow = main?.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    if (main) main.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      if (main) main.style.overflow = previousMainOverflow;
      document.body.style.overflow = previousBodyOverflow;
      trigger.current?.focus();
    };
  }, [open]);

  return <>
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-label="Apariencia y accesibilidad" title="Apariencia y accesibilidad" onClick={() => setOpen(true)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400 ${surface ? 'border border-steel-200 bg-white/70 text-steel-700 hover:bg-steel-50' : 'text-steel-300 hover:bg-white/10 hover:text-steel-100'}`}><AppearanceIcon className="h-5 w-5" /></button>
    {open && createPortal(<dialog ref={dialog} className="appearance-dialog" aria-labelledby="appearance-title" onCancel={() => setOpen(false)}>
      <header className="flex items-start justify-between gap-4"><div><p className="mb-2 text-xs font-medium text-brand-700">A tu medida</p><h2 id="appearance-title" className="font-display text-2xl font-semibold text-ink-900">Apariencia y accesibilidad</h2></div><button autoFocus type="button" aria-label="Cerrar apariencia y accesibilidad" onClick={() => setOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-steel-200 text-steel-600 hover:bg-steel-50">×</button></header>
      <p className="mt-3 text-sm leading-6 text-steel-600">Estos ajustes se aplican a las pantallas de la aplicación y se guardan en este navegador.</p>
      <fieldset className="mt-6"><legend className="mb-3 text-sm font-semibold text-ink-900">Tema de la interfaz</legend><div className="grid grid-cols-3 gap-2">{[['light', 'Claro'], ['dark', 'Oscuro'], ['system', 'Sistema']].map(([value, label]) => <label key={value} className={`appearance-theme-option ${preferences.theme === value ? 'is-selected' : ''}`}><input type="radio" name="appearance-theme" value={value} checked={preferences.theme === value} onChange={() => setPreferences((current) => ({ ...current, theme: value }))} className="sr-only" /><span aria-hidden="true" className={`appearance-theme-preview preview-${value}`}><i /><i /><i /></span><span className="text-sm font-medium">{label}</span></label>)}</div></fieldset>
      <fieldset className="mt-6 border-t border-steel-200 pt-5"><legend className="px-1 text-sm font-semibold text-ink-900">Tamaño del texto</legend><div className="mt-2 flex items-center justify-between gap-3"><button type="button" aria-label="Disminuir tamaño del texto" disabled={preferences.textSize <= 87.5} onClick={() => setPreferences((current) => ({ ...current, textSize: Math.max(87.5, current.textSize - 12.5) }))} className="appearance-size-button">A−</button><output aria-live="polite" className="text-lg font-semibold tabular-nums text-ink-900">{preferences.textSize}%</output><button type="button" aria-label="Aumentar tamaño del texto" disabled={preferences.textSize >= 125} onClick={() => setPreferences((current) => ({ ...current, textSize: Math.min(125, current.textSize + 12.5) }))} className="appearance-size-button">A+</button></div><p className="mt-3 text-xs leading-5 text-steel-600">También puedes usar el zoom propio del navegador. El visor de documentos conserva sus controles de zoom.</p></fieldset>
      <div className="mt-5 rounded-xl border border-steel-200 bg-steel-50 p-4"><p className="text-sm font-semibold text-ink-900">Vista previa</p><p className="mt-1 text-sm leading-6 text-steel-700">La información debe ser cómoda de leer y fácil de encontrar.</p></div>
      <footer className="mt-6 flex flex-wrap justify-between gap-3"><button type="button" onClick={() => setPreferences({ ...DEFAULT_APPEARANCE })} className="rounded-lg px-3 py-2 text-sm font-medium text-steel-700 hover:bg-steel-50">Restablecer</button><button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Listo</button></footer>
    </dialog>, document.body)}
  </>;
}
