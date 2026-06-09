import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Documents from './pages/Documents.jsx';
import DocumentDetail from './pages/DocumentDetail.jsx';
import Upload from './pages/Upload.jsx';
import CriteriaStructure from './pages/CriteriaStructure.jsx';
import CloudConnect from './pages/CloudConnect.jsx';
import Trash from './pages/Trash.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/documents/:id" element={<DocumentDetail />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/structure" element={<CriteriaStructure />} />
        <Route path="/cloud" element={<CloudConnect />} />
        <Route path="/trash" element={<Trash />} />
      </Route>
    </Routes>
  );
}
