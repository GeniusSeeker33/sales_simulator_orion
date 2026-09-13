-- Unified CRM foundation for join-orion.com and app.geniusseeker.com.
-- Schema only: this migration does not copy, update, or delete legacy records.
begin;

create schema crm;
revoke all on schema crm from public, anon, authenticated;
grant usage on schema crm to authenticated, service_role;

create table crm.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create table crm.workspace_members (
  workspace_id uuid not null references crm.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer','contributor','manager','admin')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create function crm.has_membership(p_workspace uuid, p_roles text[] default null)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from crm.workspace_members m
    where m.workspace_id = p_workspace
      and m.user_id = (select auth.uid())
      and (p_roles is null or m.role = any(p_roles))
  )
$$;

create table crm.organizations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references crm.workspaces(id),
  name text not null check (length(trim(name)) between 1 and 240),
  organization_type text not null check (organization_type in ('ffl_dealer','employer','partner','vendor','other')),
  lifecycle_stage text not null default 'lead' check (lifecycle_stage in ('lead','applicant','qualified','active','inactive','disqualified')),
  website text,
  email text,
  phone text,
  address jsonb not null default '{}'::jsonb check (jsonb_typeof(address) = 'object'),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  source_system text not null,
  source_entity text not null,
  source_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, source_system, source_entity, source_id)
);

create table crm.people (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references crm.workspaces(id),
  auth_user_id uuid references auth.users(id) on delete set null,
  first_name text not null default '',
  last_name text not null default '',
  preferred_name text not null default '',
  email text,
  email_normalized text generated always as (lower(trim(email))) stored,
  phone text,
  lifecycle_stage text not null default 'lead' check (lifecycle_stage in ('lead','applicant','candidate','learner','employee','alumni','inactive')),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  source_system text not null,
  source_entity text not null,
  source_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, source_system, source_entity, source_id)
);

create unique index crm_people_workspace_auth_user
  on crm.people(workspace_id, auth_user_id) where auth_user_id is not null;
create index crm_people_email_lookup on crm.people(workspace_id, email_normalized)
  where email_normalized is not null;

create table crm.organization_people (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references crm.workspaces(id),
  organization_id uuid not null,
  person_id uuid not null,
  relationship_type text not null check (relationship_type in ('owner','contact','employee','candidate','sales_rep','partner','other')),
  title text,
  is_primary boolean not null default false,
  started_at date,
  ended_at date,
  created_at timestamptz not null default now(),
  unique (workspace_id, organization_id, person_id, relationship_type),
  foreign key (workspace_id, organization_id) references crm.organizations(workspace_id, id),
  foreign key (workspace_id, person_id) references crm.people(workspace_id, id),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create table crm.applications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references crm.workspaces(id),
  application_type text not null check (application_type in ('ffl_dealer','candidate')),
  status text not null default 'submitted' check (status in ('draft','submitted','in_review','qualified','approved','rejected','withdrawn','hired','activated')),
  person_id uuid,
  organization_id uuid,
  job_ref text,
  assigned_to uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  payload_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(payload_snapshot) = 'object'),
  source_system text not null,
  source_entity text not null,
  source_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, source_system, source_entity, source_id),
  foreign key (workspace_id, person_id) references crm.people(workspace_id, id),
  foreign key (workspace_id, organization_id) references crm.organizations(workspace_id, id),
  check (person_id is not null or organization_id is not null)
);

create table crm.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references crm.workspaces(id),
  person_id uuid,
  organization_id uuid,
  application_id uuid,
  actor_user_id uuid references auth.users(id) on delete set null,
  activity_type text not null check (activity_type in ('note','call','email','meeting','interview','status_change','task','form_submission','document','other')),
  direction text check (direction in ('inbound','outbound','internal')),
  summary text not null check (length(trim(summary)) between 1 and 8000),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  source_system text not null,
  source_entity text not null,
  source_id text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, source_system, source_entity, source_id),
  foreign key (workspace_id, person_id) references crm.people(workspace_id, id),
  foreign key (workspace_id, organization_id) references crm.organizations(workspace_id, id),
  foreign key (workspace_id, application_id) references crm.applications(workspace_id, id),
  check (person_id is not null or organization_id is not null or application_id is not null)
);

create table crm.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references crm.workspaces(id),
  opportunity_type text not null check (opportunity_type in ('dealer_acquisition','placement','partnership','campaign','other')),
  name text not null check (length(trim(name)) between 1 and 240),
  stage text not null default 'identified' check (stage in ('identified','contacted','qualified','proposal','committed','won','lost','paused')),
  person_id uuid,
  organization_id uuid,
  owner_user_id uuid references auth.users(id) on delete set null,
  estimated_value numeric(14,2) check (estimated_value is null or estimated_value >= 0),
  probability smallint check (probability between 0 and 100),
  target_close_on date,
  source_system text not null,
  source_entity text not null,
  source_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, source_system, source_entity, source_id)
  ,foreign key (workspace_id, person_id) references crm.people(workspace_id, id)
  ,foreign key (workspace_id, organization_id) references crm.organizations(workspace_id, id)
);

create table crm.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references crm.workspaces(id),
  person_id uuid,
  organization_id uuid,
  application_id uuid,
  document_type text not null,
  storage_bucket text,
  storage_path text,
  external_url text,
  original_filename text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  source_system text not null,
  source_entity text not null,
  source_id text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, source_system, source_entity, source_id),
  foreign key (workspace_id, person_id) references crm.people(workspace_id, id),
  foreign key (workspace_id, organization_id) references crm.organizations(workspace_id, id),
  foreign key (workspace_id, application_id) references crm.applications(workspace_id, id),
  check (person_id is not null or organization_id is not null or application_id is not null),
  check (storage_path is not null or external_url is not null)
);

create table crm.consent_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references crm.workspaces(id),
  person_id uuid not null,
  channel text not null check (channel in ('email','phone','sms','postal','other')),
  status text not null check (status in ('unknown','opted_in','opted_out')),
  purpose text not null check (length(trim(purpose)) between 1 and 240),
  captured_at timestamptz not null default now(),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  source_system text not null,
  source_entity text not null,
  source_id text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, source_system, source_entity, source_id),
  foreign key (workspace_id, person_id) references crm.people(workspace_id, id)
);

alter table crm.workspaces enable row level security;
alter table crm.workspace_members enable row level security;
alter table crm.organizations enable row level security;
alter table crm.people enable row level security;
alter table crm.organization_people enable row level security;
alter table crm.applications enable row level security;
alter table crm.activities enable row level security;
alter table crm.opportunities enable row level security;
alter table crm.documents enable row level security;
alter table crm.consent_records enable row level security;

revoke all on all tables in schema crm from public, anon, authenticated;
grant select on all tables in schema crm to authenticated;
grant all on all tables in schema crm to service_role;

create policy crm_workspace_member_read on crm.workspaces for select to authenticated
  using (crm.has_membership(id));
create policy crm_membership_self_read on crm.workspace_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy crm_organization_member_read on crm.organizations for select to authenticated
  using (crm.has_membership(workspace_id));
create policy crm_people_member_read on crm.people for select to authenticated
  using (crm.has_membership(workspace_id));
create policy crm_organization_people_member_read on crm.organization_people for select to authenticated
  using (crm.has_membership(workspace_id));
create policy crm_application_member_read on crm.applications for select to authenticated
  using (crm.has_membership(workspace_id));
create policy crm_activity_member_read on crm.activities for select to authenticated
  using (crm.has_membership(workspace_id));
create policy crm_opportunity_member_read on crm.opportunities for select to authenticated
  using (crm.has_membership(workspace_id));
create policy crm_document_member_read on crm.documents for select to authenticated
  using (crm.has_membership(workspace_id));
create policy crm_consent_member_read on crm.consent_records for select to authenticated
  using (crm.has_membership(workspace_id));

grant execute on function crm.has_membership(uuid,text[]) to authenticated;
revoke execute on function crm.has_membership(uuid,text[]) from public, anon;

create index crm_organizations_workspace_stage on crm.organizations(workspace_id, lifecycle_stage);
create index crm_applications_workspace_status on crm.applications(workspace_id, application_type, status, submitted_at desc);
create index crm_activities_timeline on crm.activities(workspace_id, occurred_at desc);
create index crm_opportunities_pipeline on crm.opportunities(workspace_id, stage, target_close_on);

commit;
