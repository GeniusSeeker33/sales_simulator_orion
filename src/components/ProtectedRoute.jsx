import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ roles, children }) {
  const { session, loading } = useAuth();

  if (loading) return <p>Verifying sign-in…</p>;
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(session.role)) {
    const fallback = session.role === "admin" ? "/admin-view" : session.role === "manager" ? "/manager-view" : "/dashboard";
    return <Navigate to={fallback} replace />;
  }

  return <div key={session.id}>{children}</div>;
}
