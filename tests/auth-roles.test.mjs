import test from "node:test";
import assert from "node:assert/strict";
import { buildAppSession, defaultAppRoute, isAppRoleAllowed, resolveAppRole } from "../src/lib/appRoles.js";
import { getNavItems } from "../src/lib/appNavigation.js";

const NEWSLETTER_PATH = "/newsletter-admin";
const newsletterVisible = (role) => getNavItems(role).some((item) => item.to === NEWSLETTER_PATH);

test("verified Desiree app metadata restores admin Newsletter access", () => {
  const user = {
    id: "desiree-user-id",
    email: "desiree@orionwholesaleonline.com",
    app_metadata: { app_role: "admin" },
  };
  const session = buildAppSession(user);
  assert.equal(session.role, "admin");
  assert.equal(newsletterVisible(session.role), true);
  assert.equal(isAppRoleAllowed(session.role, ["manager", "admin"]), true);
  assert.equal(defaultAppRoute(session.role), "/admin-view");
});

test("ordinary learner cannot see or directly access Newsletter admin", () => {
  const session = buildAppSession({ id: "learner-id", email: "learner@example.com", app_metadata: {} });
  assert.equal(session.role, "rep");
  assert.equal(newsletterVisible(session.role), false);
  assert.equal(isAppRoleAllowed(session.role, ["manager", "admin"]), false);
});

test("existing manager role keeps Newsletter and protected-route access", () => {
  const session = buildAppSession({ id: "manager-id", email: "manager@example.com", app_metadata: { role: "manager" } });
  assert.equal(newsletterVisible(session.role), true);
  assert.equal(isAppRoleAllowed(session.role, ["manager", "admin"]), true);
  assert.equal(defaultAppRoute(session.role), "/manager-view");
});

test("auth switch rebuilds role without carrying privileged state", () => {
  const desiree = buildAppSession({ id: "desiree-id", email: "desiree@orionwholesaleonline.com", app_metadata: { app_role: "admin" } });
  const learner = buildAppSession({ id: "learner-id", email: "learner@example.com", app_metadata: {} });
  assert.equal(newsletterVisible(desiree.role), true);
  assert.equal(newsletterVisible(learner.role), false);
  assert.equal(learner.role, "rep");
});

test("refresh and relogin derive the same role from verified user metadata", () => {
  const firstUser = { id: "desiree-id", email: "desiree@orionwholesaleonline.com", app_metadata: { app_role: "admin" } };
  const refreshedUser = structuredClone(firstUser);
  assert.deepEqual(buildAppSession(refreshedUser), buildAppSession(firstUser));
});

test("email strings and user-editable metadata cannot elevate privileges", () => {
  assert.equal(resolveAppRole({ email: "desiree@orionwholesaleonline.com", user_metadata: { app_role: "admin", role: "admin" } }), "rep");
  assert.equal(resolveAppRole({ email: "spoofed@example.com", app_metadata: { app_role: "owner" } }), "rep");
  assert.equal(resolveAppRole({ email: "spoofed@example.com", app_metadata: { app_role: "admin" } }), "admin");
});
