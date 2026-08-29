import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({ baseURL });

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
    if (err.response?.status === 401 && !err.config.url.includes('/auth/login')) {
      localStorage.removeItem('qualitrack_token');
      if (location.pathname !== '/login') location.href = '/login';
    }
    // El backend rechazó la ruta por rol (EP 1.1 · EP 1.2): la sesión sigue
    // siendo válida, así que se muestra la pantalla de acceso denegado.
    if (err.response?.status === 403 && err.response?.data?.code === 'FORBIDDEN_ROLE') {
      if (location.pathname !== '/acceso-denegado') location.href = '/acceso-denegado';
    }
    return Promise.reject(err);
  }
);
