export const APP_ROLES = Object.freeze(["rep", "manager", "admin"]);

export function resolveAppRole(user) {
  // Supabase app_metadata is assigned by a trusted server/admin. Never derive
  // authorization from email or user_metadata, which the account can edit.
  const claimedRole = user?.app_metadata?.app_role ?? user?.app_metadata?.role;
  return APP_ROLES.includes(claimedRole) ? claimedRole : "rep";
}

export function buildAppSession(user) {
  if (!user?.id) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.email,
    role: resolveAppRole(user),
  };
}

export function defaultAppRoute(role) {
  if (role === "admin") return "/admin-view";
  if (role === "manager") return "/manager-view";
  return "/training";
}

export function isAppRoleAllowed(role, allowedRoles) {
  return !allowedRoles || allowedRoles.includes(role);
}
