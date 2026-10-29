import { useEffect, useRef } from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { api } from './lib/api.js';
import { useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Milestones from './components/Milestones.jsx';
import SecurityEvents from './pages/SecurityEvents.jsx';
import Documents from './pages/Documents.jsx';
import DocumentRequests, { NewDocumentRequest } from './pages/DocumentRequests.jsx';
import DocumentDetail from './pages/DocumentDetail.jsx';
import PassageViewer from './pages/PassageViewer.jsx';
import Upload from './pages/Upload.jsx';
import CriteriaStructure from './pages/CriteriaStructure.jsx';
import ReportEditor from './pages/ReportEditor.jsx';
import CloudConnect from './pages/CloudConnect.jsx';
import Trash from './pages/Trash.jsx';
import Team from './pages/Team.jsx';
import SemanticSearch from './pages/SemanticSearch.jsx';
import AccessDenied from './pages/AccessDenied.jsx';
import NotFound from './pages/NotFound.jsx';
import PublicDocumentRequest from './pages/PublicDocumentRequest.jsx';
import { ROLES } from './lib/roles.js';
import { LEVELS, MODULES, can } from './lib/permissions.js';

// Módulo que exige cada ruta (HU19). El backend revalida cada petición: esto
// solo evita que la pantalla llegue a montarse.
const { TABLERO, REPOSITORIO, SOLICITUDES, BUSQUEDA, CARGA, INFORME, NUBE } = MODULES;

// Dentro del Layout la sesión ya está garantizada; acá solo se filtra el acceso
// por módulo (HU19) y se registra la navegación bloqueada (HU20).
function Guard({ module, level, adminOnly = false, children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const denied = adminOnly ? user?.role !== ROLES.ADMIN : !can(user, module, level);
  const lastDenied = useRef(null);
  useEffect(() => {
    if (!denied) { lastDenied.current = null; return; }
    const key = `${user?.id}:${pathname}`;
    if (lastDenied.current === key) return;
    lastDenied.current = key;
    api.post('/auth/access-denied', { section: pathname }).catch((error) => console.error('No se pudo registrar el acceso denegado.', error.response?.status));
  }, [denied, pathname, user?.id]);
  if (denied) return <Navigate to="/acceso-denegado" replace />;
  return children;
}
const guard = (module, element, level) => <Guard module={module} level={level}>{element}</Guard>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/document-request/:token" element={<PublicDocumentRequest />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/acceso-denegado" element={<AccessDenied />} />
        <Route path="/app" element={guard(TABLERO, <Dashboard />)} />
        <Route path="/milestones" element={guard(TABLERO, <Milestones />)} />
        <Route path="/security-events" element={<Guard adminOnly><SecurityEvents /></Guard>} />
        <Route path="/documents" element={guard(REPOSITORIO, <Documents />)} />
        <Route path="/requests" element={guard(SOLICITUDES, <DocumentRequests />)} />
        <Route path="/requests/new" element={guard(SOLICITUDES, <NewDocumentRequest />, LEVELS.ESCRITURA)} />
        <Route path="/search" element={guard(BUSQUEDA, <SemanticSearch />)} />
        <Route path="/network" element={<Navigate to="/search?view=network" replace />} />
        <Route path="/documents/:id" element={guard([REPOSITORIO, BUSQUEDA], <DocumentDetail />)} />
        <Route path="/documents/:id/pasajes/:chunkIndex" element={guard([REPOSITORIO, BUSQUEDA], <PassageViewer />)} />
        <Route path="/upload" element={guard(CARGA, <Upload />, LEVELS.ESCRITURA)} />
        <Route path="/structure" element={guard(INFORME, <CriteriaStructure />)} />
        <Route path="/report" element={guard(INFORME, <ReportEditor />)} />
        <Route path="/cloud" element={guard(NUBE, <CloudConnect />)} />
        <Route path="/trash" element={guard(REPOSITORIO, <Trash />)} />
        <Route path="/team" element={<Guard adminOnly><Team /></Guard>} />
      </Route>
      {/* Sin este catch-all, una URL desconocida renderiza una pantalla vacía. */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
