import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage.js";
import { Dashboard } from "./pages/Dashboard.js";
import { AssetsPage } from "./pages/AssetsPage.js";
import { AuditDetail } from "./pages/AuditDetail.js";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("dacc_token");
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter basename="/DACC-Zincirleme-Geli-tirme-Protokol-">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/assets"
          element={
            <RequireAuth>
              <AssetsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/audits/:id"
          element={
            <RequireAuth>
              <AuditDetail />
            </RequireAuth>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
