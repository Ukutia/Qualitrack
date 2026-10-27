import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LEVELS, can } from '../lib/permissions.js';

/**
 * Exige sesión y, opcionalmente, un rol autorizado (EP 1.1 · EP 1.2) o un nivel
 * sobre un módulo (HU19). `module` puede ser una lista: basta con cualquiera.
 * La denegación es una redirección inmediata en el cliente —no espera al
 * backend—, así el usuario ve la respuesta muy por debajo de un segundo tanto
 * si navega por el menú como si escribe la URL a mano.
 */
export default function ProtectedRoute({ children, roles, module, level = LEVELS.LECTURA }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="p-8 text-steel-500">Cargando…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/acceso-denegado" replace />;
  }
  if (module && !can(user, module, level)) {
    return <Navigate to="/acceso-denegado" replace />;
  }
  return children;
}
