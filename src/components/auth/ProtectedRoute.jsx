import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute({ children, requireManager = false }) {
  const { session, isManager, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="login-shell">
        <p className="section-subtext">Loading…</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (requireManager && !isManager) return <Navigate to="/dashboard" replace />;

  return children;
}
