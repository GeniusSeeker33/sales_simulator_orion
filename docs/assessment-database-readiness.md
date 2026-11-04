# CRM assessment database readiness

Verified against Orion CRM project metadata on 2026-11-04:
- crm.people has UNIQUE(workspace_id,id)
- crm.applications has UNIQUE(workspace_id,id) and FK(workspace_id,person_id) to people
- crm.workspace_members has PK(workspace_id,user_id)
- authenticated has SELECT but not INSERT/UPDATE on CRM people and membership.

Before applying the draft schema:
1. Add a unique composite key on applications(workspace_id,person_id,id).
2. Enforce invitation (workspace_id,person_id) foreign key to people.
3. Enforce invitation (workspace_id,person_id,application_id) foreign key to applications.
4. Enforce results (invitation_id,workspace_id,person_id) foreign key to invitations.
5. Keep invitation and result tables outside exposed Data API schemas, with RLS enabled and no anon/authenticated grants.
6. Confirm the trusted server database connection can access these private tables and that its permissions cannot be used by client code.
7. Execute the SQL on staging and test cross-workspace insertion, cross-candidate association, duplicate submission, and rollback.
8. Do not apply to production until the tests pass.
