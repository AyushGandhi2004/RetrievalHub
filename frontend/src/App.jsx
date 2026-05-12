import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage    from './pages/LandingPage';
import IngestionPage  from './pages/IngestionPage';
import ChatPage       from './pages/ChatPage';
import ErrorBoundary  from './components/common/ErrorBoundary';
import Toast          from './components/common/Toast';

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        {/* Global toast overlay — rendered above all page content */}
        <Toast />
        <Routes>
          <Route path="/"       element={<LandingPage />} />
          <Route path="/ingest" element={<IngestionPage />} />
          <Route path="/chat"   element={<ChatPage />} />
          <Route path="*"       element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
