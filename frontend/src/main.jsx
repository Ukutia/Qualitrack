import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient.js';
import { AuthProvider } from './context/AuthContext.jsx';
import App from './App.jsx';
import { AppearanceProvider } from './context/AppearanceContext.jsx';
import { readAppearance, resolveTheme } from './lib/appearance.js';
import './index.css';
import './accessibility.css';

// Apply saved preferences before rendering, including on a direct visit to login.
try {
  const preferences = readAppearance(window.localStorage);
  document.documentElement.dataset.appTheme = resolveTheme(preferences.theme, window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.style.fontSize = `${preferences.textSize}%`;
} catch { /* The provider still applies defaults when storage is unavailable. */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppearanceProvider><App /></AppearanceProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
