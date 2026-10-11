import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import Landing from './pages/Landing.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MandateCreate from './pages/MandateCreate.jsx';
import DisputeCenter from './pages/DisputeCenter.jsx';
import AuditTrail from './pages/AuditTrail.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="mandates/new" element={<MandateCreate />} />
        <Route path="disputes" element={<DisputeCenter />} />
        <Route path="audit" element={<AuditTrail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
