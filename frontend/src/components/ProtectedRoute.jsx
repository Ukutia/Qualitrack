import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Exige sesión y, opcionalmente, un rol autorizado (EP 1.1 · EP 1.2).
 * La denegación es una redirección inmediata en el cliente —no espera al
 * backend—, así el usuario ve la respuesta muy por debajo de un segundo tanto
 * si navega por el menú como si escribe la URL a mano.
 */
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="p-8 text-steel-500">Cargando…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/acceso-denegado" replace />;
  }
  return children;
}
