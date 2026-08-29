import { Navigate, Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Documents from './pages/Documents.jsx';
import DocumentDetail from './pages/DocumentDetail.jsx';
import Upload from './pages/Upload.jsx';
import CriteriaStructure from './pages/CriteriaStructure.jsx';
import ReportEditor from './pages/ReportEditor.jsx';
import CloudConnect from './pages/CloudConnect.jsx';
import Trash from './pages/Trash.jsx';
import SemanticSearch from './pages/SemanticSearch.jsx';
import AccessDenied from './pages/AccessDenied.jsx';
import { ROLES } from './lib/roles.js';

// Roles con acceso a cada ruta (EP 1.1 · EP 1.2). El backend revalida cada
// petición: esto solo evita que la pantalla llegue a montarse.
const ADMIN_ONLY = [ROLES.ADMIN];
const ADMIN_AND_USER = [ROLES.ADMIN, ROLES.USER];

// Dentro del Layout la sesión ya está garantizada; acá solo se filtra por rol.
function Guard({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <Navigate to="/acceso-denegado" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/acceso-denegado" element={<AccessDenied />} />
        <Route path="/app" element={<Guard roles={ADMIN_ONLY}><Dashboard /></Guard>} />
        <Route path="/documents" element={<Guard roles={ADMIN_AND_USER}><Documents /></Guard>} />
        <Route path="/search" element={<Guard roles={ADMIN_ONLY}><SemanticSearch /></Guard>} />
        <Route path="/documents/:id" element={<Guard roles={ADMIN_AND_USER}><DocumentDetail /></Guard>} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/structure" element={<Guard roles={ADMIN_ONLY}><CriteriaStructure /></Guard>} />
        <Route path="/report" element={<Guard roles={ADMIN_ONLY}><ReportEditor /></Guard>} />
        <Route path="/cloud" element={<Guard roles={ADMIN_AND_USER}><CloudConnect /></Guard>} />
        <Route path="/trash" element={<Guard roles={ADMIN_ONLY}><Trash /></Guard>} />
      </Route>
    </Routes>
  );
}
