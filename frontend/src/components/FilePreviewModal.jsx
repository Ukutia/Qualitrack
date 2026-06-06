import React from 'react';
import { api } from '../lib/api.js';

export default function FilePreviewModal({ isOpen, onClose, doc }) {
  if (!isOpen || !doc) return null;

  const token = localStorage.getItem('qualitrack_token');
  // Usamos timestamp para romper la caché del navegador por si se quedó guardado el header de "attachment" de pruebas anteriores
  const fileUrl = `${api.defaults.baseURL}/documents/${doc.id}/file?token=${token}&t=${Date.now()}`;

  // Formatos que el navegador puede renderizar de forma nativa.
  const previewableFormats = ['pdf', 'txt', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
  const isPreviewable = previewableFormats.includes((doc.format || '').toLowerCase());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      {/* Contenedor del Modal */}
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl flex flex-col h-[85vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3 truncate">
            <h3 className="font-semibold text-slate-800 truncate" title={doc.name}>
              {doc.name}
            </h3>
            <span className="shrink-0 uppercase text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">
              {doc.format}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <a
              href={`${fileUrl}&download=1`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              Descargar original
            </a>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"
              aria-label="Cerrar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Contenido (Visor) */}
        <div className="flex-1 overflow-hidden bg-slate-100 flex items-center justify-center relative">
          {isPreviewable ? (
            <iframe
              src={fileUrl}
              title={`Vista previa de ${doc.name}`}
              className="w-full h-full border-0"
            />
          ) : (
            <div className="text-center p-8 max-w-md">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h4 className="text-lg font-semibold text-slate-800 mb-2">Vista previa no disponible</h4>
                <p className="text-sm text-slate-500 mb-6">
                  El formato <strong>{doc.format?.toUpperCase()}</strong> no soporta previsualización web directa de forma nativa por el momento en Qualitrack.
                </p>
                <a
                  href={`${fileUrl}&download=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block bg-brand-600 hover:bg-brand-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
                >
                  Descargar archivo original
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
