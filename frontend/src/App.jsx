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

// Página pública: si ya hay sesión, va directo al tablero en vez de la landing.
function Home() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-steel-500">Cargando…</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Landing />;
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
        <Route path="/app" element={<Dashboard />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/documents/:id" element={<DocumentDetail />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/structure" element={<CriteriaStructure />} />
        <Route path="/report" element={<ReportEditor />} />
        <Route path="/cloud" element={<CloudConnect />} />
        <Route path="/trash" element={<Trash />} />
      </Route>
    </Routes>
  );
}
