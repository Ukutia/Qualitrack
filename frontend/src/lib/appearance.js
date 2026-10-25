export const APPEARANCE_KEY = 'qualitrack_appearance';
export const DEFAULT_APPEARANCE = { theme: 'system', textSize: 100 };

export function normalizeAppearance(value) {
  return {
    theme: ['light', 'dark', 'system'].includes(value?.theme) ? value.theme : 'system',
    textSize: typeof value?.textSize === 'number' && Number.isFinite(value.textSize)
      ? Math.max(87.5, Math.min(125, value.textSize)) : 100,
  };
}

export function readAppearance(storage) {
  try { return normalizeAppearance(JSON.parse(storage.getItem(APPEARANCE_KEY))); }
  catch { return { ...DEFAULT_APPEARANCE }; }
}

export function resolveTheme(theme, systemDark) {
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}
