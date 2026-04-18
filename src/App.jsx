import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Training from "./pages/Training";
import Accounts from "./pages/Accounts";
import Activity from "./pages/Activity";
import Leaderboard from "./pages/Leaderboard";
import Levels from "./pages/Levels";
import RepMetrics from "./pages/RepMetrics";

export default function App() {
  return (
    <Routes>
      {/* Default Route */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Core Pages */}
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/accounts" element={<Accounts />} />
      <Route path="/training" element={<Training />} />

      {/* Performance + Gamification */}
      <Route path="/levels" element={<Levels />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/activity" element={<Activity />} />

      {/* NEW: Compensation Input Engine */}
      <Route path="/rep-metrics" element={<RepMetrics />} />

      {/* Fallback (optional but recommended) */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}