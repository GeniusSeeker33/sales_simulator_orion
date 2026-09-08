export const REP_NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/sales-simulator", label: "AI Sales Simulator" },
  { to: "/training", label: "Training" },
  { to: "/reviewer-history", label: "Assigned Learner History" },
  { to: "/my-coaching", label: "My Coaching" },
  { to: "/accounts", label: "Accounts" },
  { to: "/ffl-prospects", label: "FFL Prospect Hub" },
  { to: "/activity", label: "Activity" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/training-leaderboard", label: "Prize Leaderboard" },
  { to: "/levels", label: "Level Progress" },
  { to: "/rep-metrics", label: "Rep Metrics" },
];

export const MANAGER_NAV = [
  ...REP_NAV,
  { to: "/manager-view", label: "Manager View", divider: true },
  { to: "/pace-report", label: "Pace Report" },
  { to: "/commission-report", label: "Commission Report" },
  { to: "/product-mix", label: "Product Mix" },
  { to: "/employees", label: "Employees" },
  { to: "/newsletter-admin", label: "Newsletter" },
];

export const ADMIN_NAV = [
  ...MANAGER_NAV,
  { to: "/admin-view", label: "Admin View", divider: true },
  { to: "/admin/import", label: "Import Data" },
];

const PROTECTED_PATHS = new Set([
  "/manager-view",
  "/pace-report",
  "/commission-report",
  "/product-mix",
  "/employees",
  "/newsletter-admin",
  "/admin-view",
  "/admin/import",
]);

export function getNavItems(role) {
  let items = role === "admin" ? ADMIN_NAV : role === "manager" ? MANAGER_NAV : REP_NAV;

  if (role !== "admin" && role !== "manager") {
    items = items.filter((item) => !PROTECTED_PATHS.has(item.to));
  }
  if (role !== "admin") {
    items = items.filter((item) => item.to !== "/admin-view" && item.to !== "/admin/import");
  }

  return items;
}
