import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Training from "./pages/Training";
import Accounts from "./pages/Accounts";
import Activity from "./pages/Activity";
import Leaderboard from "./pages/Leaderboard";
import Levels from "./pages/Levels";
import RepMetrics from "./pages/RepMetrics";
import ManagerView from "./pages/ManagerView";
import Employees from "./pages/Employees";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
      <Route path="/training" element={<ProtectedRoute><Training /></ProtectedRoute>} />
      <Route path="/levels" element={<ProtectedRoute><Levels /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
      <Route path="/activity" element={<ProtectedRoute><Activity /></ProtectedRoute>} />
      <Route path="/rep-metrics" element={<ProtectedRoute><RepMetrics /></ProtectedRoute>} />

      {/* Manager-only routes */}
      <Route path="/manager-view" element={<ProtectedRoute requireManager><ManagerView /></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute requireManager><Employees /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
