import { Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Training from "./pages/Training";
import Accounts from "./pages/Accounts";
import Activity from "./pages/Activity";
import Leaderboard from "./pages/Leaderboard";
import Levels from "./pages/Levels";
import RepMetrics from "./pages/RepMetrics";
import ManagerView from "./pages/ManagerView";
import SalesSimulator from "./pages/SalesSimulator";
import Employees from "./pages/Employees";

export default function App() {
  return (
    <Routes>
      {/* Default Route */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Core Pages */}
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/sales-simulator" element={<SalesSimulator />} />
      <Route path="/training" element={<Training />} />
      <Route path="/accounts" element={<Accounts />} />
      <Route path="/activity" element={<Activity />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/levels" element={<Levels />} />
      <Route path="/rep-metrics" element={<RepMetrics />} />
      <Route path="/manager-view" element={<ManagerView />} />
      <Route path="/employees" element={<Employees />} />

      {/* ✅ Sales Simulator (must be BEFORE wildcard) */}
      <Route path="/sales-simulator" element={<SalesSimulator />} />

      {/* Catch-All Route (ALWAYS LAST) */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}