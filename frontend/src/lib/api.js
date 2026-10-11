import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL,
});
// Adjunta el JWT guardado en localStorage a cada petición.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qualitrack_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Si el token expira, limpia y redirige a login.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isPublicDocumentRequest = /^\/document-request\/[^/]+\/?$/.test(location.pathname);
    if (
      err.response?.status === 401 &&
      !err.config.url.includes('/auth/login') &&
      !isPublicDocumentRequest
    ) {
      localStorage.removeItem('qualitrack_token');
      if (location.pathname !== '/login') location.href = '/login';
    }
    // Las rutas protegidas deciden el acceso mediante los guards de React.
    // No se redirige globalmente ante un 403: una respuesta tardía de la
    // sesión anterior podría llegar después de iniciar sesión con otro rol y
    // reemplazar el destino correcto. El error queda disponible para que la
    // pantalla que originó la petición lo maneje en su propio contexto.
    return Promise.reject(err);
  }
);
