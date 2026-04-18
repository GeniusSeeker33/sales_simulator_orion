import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Training from "./pages/Training";
import Accounts from "./pages/Accounts";
import Activity from "./pages/Activity";
import Leaderboard from "./pages/Leaderboard";
import Levels from "./pages/Levels";
import RepMetrics from "./pages/RepMetrics";
import ManagerView from "./pages/ManagerView";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/training" element={<Training />} />
      <Route path="/accounts" element={<Accounts />} />
      <Route path="/activity" element={<Activity />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/levels" element={<Levels />} />
      <Route path="/rep-metrics" element={<RepMetrics />} />
      <Route path="/manager-view" element={<ManagerView />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}