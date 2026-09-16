-- Durable, workspace-scoped reviewed exclusions for hosted Join-Orion intake.
-- Deliberately contains governance metadata only, never candidate payloads.
begin;

create table crm.join_orion_source_exclusions (
  workspace_id uuid not null references crm.workspaces(id) on delete cascade,
  source_system text not null default 'join-orion' check (source_system = 'join-orion'),
  application_source_id uuid not null,
  classification text not null check (classification in ('historical_test_data')),
  reason text not null check (length(trim(reason)) between 1 and 1000),
  reviewed_by text not null check (length(trim(reviewed_by)) between 1 and 320),
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, source_system, application_source_id)
);

alter table crm.join_orion_source_exclusions enable row level security;
revoke all on crm.join_orion_source_exclusions from public, anon, authenticated;
grant select on crm.join_orion_source_exclusions to authenticated;
grant all on crm.join_orion_source_exclusions to service_role;
create policy crm_join_orion_exclusion_reviewer_read on crm.join_orion_source_exclusions
  for select to authenticated using (crm.has_membership(workspace_id, array['manager','admin']));

commit;
