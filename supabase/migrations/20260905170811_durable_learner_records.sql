-- Apply only after IT/identity-owner approval. No production deployment in this PR.
-- Minimal verified identity projection; not a competing person/employment master.
create table public.learner_bindings (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id),
  person_id uuid not null,
  employment_episode_id uuid not null,
  organization_scope text not null check (length(organization_scope) > 0),
  role_scope_ref text not null check (length(role_scope_ref) > 0),
  source_environment text not null check (length(source_environment) > 0),
  source_project text not null check (length(source_project) > 0),
  identity_source_ref text not null check (length(identity_source_ref) > 0),
  employment_source_ref text not null check (length(employment_source_ref) > 0),
  verified_by uuid not null references auth.users(id),
  verified_at timestamptz not null default now(),
  verification_evidence_ref text not null check (length(verification_evidence_ref) > 0),
  supersedes_id uuid references public.learner_bindings(id),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  revocation_reason text,
  check (verified_by <> auth_user_id),
  check ((revoked_at is null and revoked_by is null and revocation_reason is null)
    or (revoked_at is not null and revoked_by is not null and revocation_reason is not null and length(revocation_reason) > 0))
);
create unique index one_current_learner_binding on public.learner_bindings(auth_user_id) where revoked_at is null;

create table public.learner_training_attempts (
  id uuid primary key,
  binding_id uuid not null references public.learner_bindings(id),
  auth_user_id uuid not null references auth.users(id),
  person_id uuid not null,
  employment_episode_id uuid not null,
  organization_scope text not null,
  source_environment text not null,
  source_project text not null,
  source_system text not null default 'sales_simulator_orion',
  source_entity text not null default 'learner_training_attempts',
  kind text not null check (kind in ('written', 'simulation')),
  scenario_ref text not null check (length(scenario_ref) between 1 and 150),
  content_version text not null default 'orion-practice-v1',
  status text not null default 'in_progress' check (status in ('in_progress','completed','technical_failure','abandoned')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ai_score jsonb,
  assessment_status text not null default 'unscored' check (assessment_status in ('unscored','ai_unreviewed')),
  criteria_version text,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  check ((status = 'in_progress' and ended_at is null) or (status <> 'in_progress' and ended_at is not null)),
  check ((ai_score is null and assessment_status = 'unscored' and criteria_version is null)
    or (ai_score is not null and kind = 'simulation' and status = 'completed'
      and assessment_status = 'ai_unreviewed' and criteria_version is not null and criteria_version = 'legacy-score-call-v1')),
  unique(id, binding_id, auth_user_id, person_id, employment_episode_id, organization_scope)
);
create table public.learner_simulation_sessions (
  id uuid primary key default gen_random_uuid(),
  training_attempt_id uuid not null unique,
  binding_id uuid not null,
  auth_user_id uuid not null,
  person_id uuid not null,
  employment_episode_id uuid not null,
  organization_scope text not null,
  source_environment text not null,
  source_project text not null,
  source_system text not null default 'sales_simulator_orion',
  source_entity text not null default 'learner_simulation_sessions',
  scenario_ref text not null,
  content_version text not null default 'orion-practice-v1',
  difficulty_ref text,
  simulation_origin text not null default 'AI practice',
  status text not null default 'in_progress' check (status in ('in_progress','completed','technical_failure','abandoned')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  foreign key (training_attempt_id,binding_id,auth_user_id,person_id,employment_episode_id,organization_scope)
    references public.learner_training_attempts(id,binding_id,auth_user_id,person_id,employment_episode_id,organization_scope)
);
create index learner_attempt_history on public.learner_training_attempts(auth_user_id,started_at desc);
create index learner_simulation_owner on public.learner_simulation_sessions(auth_user_id);

alter table public.learner_bindings enable row level security;
alter table public.learner_training_attempts enable row level security;
alter table public.learner_simulation_sessions enable row level security;
revoke all on public.learner_bindings, public.learner_training_attempts, public.learner_simulation_sessions from public, anon, authenticated;
grant select on public.learner_bindings, public.learner_training_attempts, public.learner_simulation_sessions to authenticated;
-- No manager/admin policy or writable client table grants.
create policy own_binding on public.learner_bindings for select to authenticated using (auth_user_id = (select auth.uid()));
create policy own_attempt on public.learner_training_attempts for select to authenticated
  using (auth_user_id = (select auth.uid()) and exists (
    select 1 from public.learner_bindings b where b.id = binding_id and b.revoked_at is null));
create policy own_simulation on public.learner_simulation_sessions for select to authenticated
  using (auth_user_id = (select auth.uid()) and exists (
    select 1 from public.learner_bindings b where b.id = binding_id and b.revoked_at is null));

-- Trusted operators revoke and replace mappings; never silently relabel past records.
create function public.protect_learner_binding() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Revoke bindings; do not delete history'; end if;
  if (to_jsonb(new) - array['revoked_at','revoked_by','revocation_reason'])
      is distinct from (to_jsonb(old) - array['revoked_at','revoked_by','revocation_reason'])
      or old.revoked_at is not null or new.revoked_at is null then
    raise exception 'Bindings are immutable; revoke and replace with a correction reference';
  end if;
  return new;
end; $$;
create trigger immutable_learner_binding before update or delete on public.learner_bindings
  for each row execute function public.protect_learner_binding();
revoke all on function public.protect_learner_binding() from public, anon, authenticated;

-- SECURITY DEFINER is deliberately limited to two commands. They validate auth.uid(),
-- an active human-verified binding, ownership, and terminal state; no caller-supplied identity.
create function public.begin_learner_attempt(p_id uuid, p_kind text, p_scenario text, p_difficulty text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare b public.learner_bindings; a public.learner_training_attempts;
begin
  select * into b from public.learner_bindings where auth_user_id = auth.uid() and revoked_at is null for share;
  if not found then raise exception 'Verified learner enrollment required' using errcode = '42501'; end if;
  if p_id is null or p_kind is null or p_kind not in ('written','simulation') or p_scenario is null
    or length(p_scenario) not between 1 and 150 or length(p_difficulty) > 80 then
    raise exception 'Invalid practice context';
  end if;
  insert into public.learner_training_attempts(id,binding_id,auth_user_id,person_id,employment_episode_id,
    organization_scope,source_environment,source_project,kind,scenario_ref)
    values(p_id,b.id,b.auth_user_id,b.person_id,b.employment_episode_id,
      b.organization_scope,b.source_environment,b.source_project,p_kind,p_scenario)
    on conflict (id) do nothing;
  select * into a from public.learner_training_attempts where id=p_id;
  if a.binding_id <> b.id or a.kind <> p_kind or a.scenario_ref <> p_scenario then
    raise exception 'Record conflict' using errcode = '42501';
  end if;
  if p_kind='simulation' then
    insert into public.learner_simulation_sessions(training_attempt_id,binding_id,auth_user_id,person_id,employment_episode_id,
      organization_scope,source_environment,source_project,scenario_ref,difficulty_ref)
      values(a.id,b.id,b.auth_user_id,b.person_id,b.employment_episode_id,
        b.organization_scope,b.source_environment,b.source_project,p_scenario,p_difficulty)
      on conflict(training_attempt_id) do nothing;
  end if;
  return a.id;
end; $$;

create function public.finish_learner_attempt(p_id uuid, p_status text, p_ai_score jsonb default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.learner_training_attempts; b public.learner_bindings; k text;
begin
  select * into b from public.learner_bindings where auth_user_id=auth.uid() and revoked_at is null for share;
  if not found then raise exception 'Verified learner enrollment required' using errcode = '42501'; end if;
  select * into a from public.learner_training_attempts where id=p_id and binding_id=b.id for update;
  if not found then raise exception 'Record unavailable' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('completed','technical_failure','abandoned') then raise exception 'Invalid status'; end if;
  if p_ai_score is not null then
    if p_status <> 'completed' or a.kind <> 'simulation' or jsonb_typeof(p_ai_score) <> 'object' then raise exception 'Failure must be unscored'; end if;
    if (select count(*) from jsonb_object_keys(p_ai_score)) <> 5 then raise exception 'Invalid AI suggestion'; end if;
    foreach k in array array['overall','discovery','orderBuilding','objectionHandling','closing'] loop
      if not (p_ai_score ? k) or jsonb_typeof(p_ai_score->k) <> 'number' then raise exception 'Invalid AI suggestion'; end if;
      if (p_ai_score->>k)::numeric not between 0 and 100 then raise exception 'Invalid AI suggestion'; end if;
    end loop;
  end if;
  if a.status <> 'in_progress' then
    if a.status = p_status and a.ai_score is not distinct from p_ai_score then return a.id; end if;
    raise exception 'Terminal record is immutable';
  end if;
  update public.learner_training_attempts set status=p_status, ended_at=now(),updated_at=now(),revision=2,
    ai_score=p_ai_score, assessment_status=case when p_ai_score is null then 'unscored' else 'ai_unreviewed' end,
    criteria_version=case when p_ai_score is null then null else 'legacy-score-call-v1' end
    where id=a.id;
  update public.learner_simulation_sessions set status=p_status, ended_at=now(),updated_at=now(),revision=2
    where training_attempt_id=a.id;
  return a.id;
end; $$;
revoke all on function public.begin_learner_attempt(uuid,text,text,text), public.finish_learner_attempt(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.begin_learner_attempt(uuid,text,text,text), public.finish_learner_attempt(uuid,text,jsonb) to authenticated;
