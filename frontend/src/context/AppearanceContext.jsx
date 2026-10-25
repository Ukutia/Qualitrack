import { createContext, useContext, useEffect, useState } from 'react';
import { APPEARANCE_KEY, DEFAULT_APPEARANCE, readAppearance, resolveTheme } from '../lib/appearance.js';

const AppearanceContext = createContext(null);

export function AppearanceProvider({ children }) {
  const [preferences, setPreferences] = useState(() => {
    try { return readAppearance(window.localStorage); } catch { return { ...DEFAULT_APPEARANCE }; }
  });
  useEffect(() => {
    const root = document.documentElement;
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      root.dataset.appTheme = resolveTheme(preferences.theme, system.matches);
      root.style.fontSize = `${preferences.textSize}%`;
    };
    apply();
    system.addEventListener('change', apply);
    try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(preferences)); } catch { /* Preferences also work without storage. */ }
    return () => system.removeEventListener('change', apply);
  }, [preferences]);
  return <AppearanceContext.Provider value={{ preferences, setPreferences }}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() { return useContext(AppearanceContext); }
