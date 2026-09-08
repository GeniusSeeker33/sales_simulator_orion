# Application-role provisioning for Supabase Auth

## Deployment prerequisite

The application resolves navigation and route roles from the authenticated Supabase Auth user’s **server/admin-controlled `app_metadata`**. The real Desiree Auth user does not currently have `app_metadata.app_role` populated, so merging the application change alone will continue to fail closed to `rep` and will **not** restore Newsletter access.

Before or immediately after deploying the auth-role fix, an authorized Supabase administrator must assign Desiree’s intended application role (`manager` or `admin`, according to the approved access decision) to `app_metadata.app_role` on her existing Auth user. Perform that operation through an approved server-side/admin process or the Supabase administrative interface, verify the exact Auth user ID, and record it under the organization’s access-change procedure.

Do not:

* infer a privileged role from an email address;
* write the role to `user_metadata`, which an account can edit;
* expose a service-role key or admin role-update operation to the browser;
* let the browser assign or change its own role; or
* grant manager/admin to all authenticated users.

After provisioning, invalidate/refresh the affected Auth session as required so a fresh `getUser()`/login result contains the administrator-assigned metadata. Validate both password and magic-link/session rehydration, Newsletter navigation, and `/newsletter-admin`. Removing or invalidating the app role must return the account to the fail-closed `rep` behavior on the next authoritative refresh.

## Accepted metadata contract

The application accepts only `rep`, `manager`, or `admin`. It prefers `app_metadata.app_role`; `app_metadata.role` is read only for compatibility with an existing server-managed convention. Missing, malformed, or any other value resolves to `rep`. Email and `user_metadata` have no authorization effect.

This is application navigation/route authorization only. It does not grant reviewer scopes, learner access, database privileges, RLS access, or service-role capability.
