import React from 'react';
import ReactDOM from 'react-dom/client';
import Landing from './pages/Landing.jsx';
import { readAppearance, resolveTheme } from './lib/appearance.js';
import './index.css';
import './accessibility.css';

// La landing aislada comparte las preferencias de accesibilidad de la app.
try {
  const preferences = readAppearance(window.localStorage);
  document.documentElement.dataset.appTheme = resolveTheme(
    preferences.theme,
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  document.documentElement.style.fontSize = `${preferences.textSize}%`;
} catch { /* La landing conserva sus valores predeterminados si no hay almacenamiento. */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Landing />
  </React.StrictMode>,
);
