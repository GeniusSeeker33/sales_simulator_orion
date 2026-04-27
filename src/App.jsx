import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import AdminImport from "./pages/AdminImport.jsx";
import Dashboard from "./pages/Dashboard";
import Training from "./pages/Training";
import Accounts from "./pages/Accounts";
import Activity from "./pages/Activity";
import Leaderboard from "./pages/Leaderboard";
import TrainingLeaderboard from "./pages/TrainingLeaderboard";
import Levels from "./pages/Levels";
import RepMetrics from "./pages/RepMetrics";
import ManagerView from "./pages/ManagerView";
import SalesSimulator from "./pages/SalesSimulator";
import Employees from "./pages/Employees";
import AdminView from "./pages/AdminView";

function RootRedirect() {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (session.role === "admin") return <Navigate to="/admin-view" replace />;
  if (session.role === "manager") return <Navigate to="/manager-view" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RootRedirect />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/sales-simulator" element={<ProtectedRoute><SalesSimulator /></ProtectedRoute>} />
      <Route path="/training" element={<ProtectedRoute><Training /></ProtectedRoute>} />
      <Route path="/accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
      <Route path="/activity" element={<ProtectedRoute><Activity /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
      <Route path="/training-leaderboard" element={<ProtectedRoute><TrainingLeaderboard /></ProtectedRoute>} />
      <Route path="/levels" element={<ProtectedRoute><Levels /></ProtectedRoute>} />
      <Route path="/rep-metrics" element={<ProtectedRoute><RepMetrics /></ProtectedRoute>} />

      <Route path="/manager-view" element={<ProtectedRoute roles={["manager", "admin"]}><ManagerView /></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute roles={["manager", "admin"]}><Employees /></ProtectedRoute>} />

      <Route path="/admin-view" element={<ProtectedRoute roles={["admin"]}><AdminView /></ProtectedRoute>} />
      <Route path="/admin/import" element={<ProtectedRoute roles={["admin"]}><AdminImport /></ProtectedRoute>} />

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
