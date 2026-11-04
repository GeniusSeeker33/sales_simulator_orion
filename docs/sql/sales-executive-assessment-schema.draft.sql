-- DESIGN DRAFT ONLY: do not apply before confirming CRM migration conventions.
-- These tables belong to the private CRM schema; no client Data API access.
create table if not exists crm.sales_assessment_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references crm.workspaces(id),
  person_id uuid not null references crm.people(id),
  application_id uuid references crm.applications(id),
  assessment_version text not null,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'invited'
    check (status in ('invited','opened','in_progress','completed','expired','revoked')),
  invited_by uuid not null references auth.users(id),
  invited_at timestamptz not null default now(),
  opened_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null,
  constraint assessment_expiry_after_invite check (expires_at > invited_at),
  unique (id, workspace_id, person_id)
);
create index if not exists sales_assessment_invitations_candidate_idx
  on crm.sales_assessment_invitations (workspace_id, person_id, invited_at desc);
create table if not exists crm.sales_assessment_results (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique,
  workspace_id uuid not null,
  person_id uuid not null,
  assessment_version text not null,
  responses jsonb not null,
  readiness jsonb not null,
  score jsonb not null,
  submitted_at timestamptz not null default now(),
  foreign key (invitation_id, workspace_id, person_id)
    references crm.sales_assessment_invitations(id, workspace_id, person_id),
  constraint assessment_responses_object check (jsonb_typeof(responses) = 'object'),
  constraint assessment_readiness_object check (jsonb_typeof(readiness) = 'object'),
  constraint assessment_score_object check (jsonb_typeof(score) = 'object')
);
create index if not exists sales_assessment_results_candidate_idx
  on crm.sales_assessment_results (workspace_id, person_id, submitted_at desc);
alter table crm.sales_assessment_invitations enable row level security;
alter table crm.sales_assessment_results enable row level security;
-- No broad authenticated/anon grants or policies: access via authorized
-- server transaction only. Confirm CRM database role and privilege design.
-- Enforce same-workspace person/application references in the write transaction;
-- the single-column foreign keys above do not establish tenant equality.
-- Submission must lock the invitation row FOR UPDATE, verify token hash,
-- expiry, version and candidate, insert one result, and set completed
-- within ONE transaction. The unique invitation_id prevents duplicates.
