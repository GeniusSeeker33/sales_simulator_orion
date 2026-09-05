-- Issue #19: read-only reviewer projection. Existing learner RLS/write RPCs unchanged.
create schema learner_review;
revoke all on schema learner_review from public, anon, authenticated;
grant usage on schema learner_review to authenticated;

create table learner_review.scopes (
  id uuid primary key default gen_random_uuid(),
  reviewer_user_id uuid not null references auth.users(id),
  learner_binding_id uuid not null references public.learner_bindings(id),
  reviewer_role text not null check (reviewer_role in ('manager','coach')),
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  approval_ref text not null check (length(trim(approval_ref)) > 0),
  expires_at timestamptz not null,
  supersedes_id uuid references learner_review.scopes(id),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  revocation_reason text,
  check (approved_by <> reviewer_user_id),
  check (expires_at > approved_at),
  check ((revoked_at is null and revoked_by is null and revocation_reason is null)
    or (revoked_at is not null and revoked_by is not null and revocation_reason is not null and length(trim(revocation_reason)) > 0))
);
alter table learner_review.scopes enable row level security;
revoke all on learner_review.scopes from public, anon, authenticated;
create index reviewer_scope_lookup on learner_review.scopes(reviewer_user_id, expires_at) where revoked_at is null;
create index reviewer_binding_lookup on learner_review.scopes(learner_binding_id);
create index reviewer_attempt_page on public.learner_training_attempts(binding_id, started_at desc, id desc);

-- Only trusted provisioning can insert/revoke. Corrections revoke and replace.
create function learner_review.protect_scope() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Revoke scopes; do not delete audit history'; end if;
  if (to_jsonb(new) - array['revoked_at','revoked_by','revocation_reason'])
    is distinct from (to_jsonb(old) - array['revoked_at','revoked_by','revocation_reason'])
    or old.revoked_at is not null or new.revoked_at is null then
    raise exception 'Scope is immutable; revoke and replace';
  end if;
  return new;
end; $$;
create trigger immutable_reviewer_scope before update or delete on learner_review.scopes
for each row execute function learner_review.protect_scope();

-- Privileged implementation stays outside exposed API schemas.
-- Explicit auth/scope checks are required because this narrowly projected read bypasses RLS.
create function learner_review.read_history(p_scope_id uuid, p_before timestamptz, p_before_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_binding uuid; v_scopes jsonb; v_rows jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if (p_before is null) <> (p_before_id is null) then raise exception 'Incomplete cursor'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'reviewer_role', g.reviewer_role,
    'person_id', b.person_id, 'employment_episode_id', b.employment_episode_id,
    'organization_scope', b.organization_scope, 'role_scope_ref', b.role_scope_ref,
    'binding_retired', b.revoked_at is not null
  ) order by b.organization_scope, b.person_id, b.employment_episode_id, g.id), '[]'::jsonb)
  into v_scopes from learner_review.scopes g
  join public.learner_bindings b on b.id=g.learner_binding_id
  where g.reviewer_user_id=v_user and g.revoked_at is null and g.expires_at > statement_timestamp()
    and g.approved_at <= statement_timestamp();

  if p_scope_id is null then return jsonb_build_object('scopes',v_scopes,'records','[]'::jsonb); end if;
  select g.learner_binding_id into v_binding from learner_review.scopes g
  where g.id=p_scope_id and g.reviewer_user_id=v_user and g.revoked_at is null
    and g.expires_at > statement_timestamp() and g.approved_at <= statement_timestamp();
  if not found then raise exception 'Reviewer scope unavailable' using errcode='42501'; end if;

  -- Exact binding, not person/email/rep-code matching. No inheritance across rehires.
  -- Historical revoked learner bindings are readable only by a separately approved scope.
  select coalesce(jsonb_agg(x.record order by x.started_at desc,x.id desc),'[]'::jsonb) into v_rows
  from (
    select a.started_at,a.id,jsonb_build_object(
      'id',a.id,'kind',a.kind,'scenario_ref',a.scenario_ref,'content_version',a.content_version,
      'status',a.status,'started_at',a.started_at,'ended_at',a.ended_at,
      'assessment_status',a.assessment_status,'criteria_version',a.criteria_version,
      'ai_overall',case when a.status='completed' and a.assessment_status='ai_unreviewed'
        then a.ai_score->'overall' else null end,
      'source_environment',a.source_environment,'source_project',a.source_project,
      'session',case when s.id is null then null else jsonb_build_object(
        'id',s.id,'scenario_ref',s.scenario_ref,'difficulty_ref',s.difficulty_ref,
        'content_version',s.content_version,'status',s.status,'started_at',s.started_at,'ended_at',s.ended_at
      ) end
    ) as record
    from public.learner_training_attempts a
    left join public.learner_simulation_sessions s on s.training_attempt_id=a.id and s.binding_id=a.binding_id
    where a.binding_id=v_binding and (p_before is null or (a.started_at,a.id) < (p_before,p_before_id))
    order by a.started_at desc,a.id desc limit 51
  ) x;
  return jsonb_build_object('scopes',v_scopes,'records',v_rows);
end; $$;

-- Public transport wrapper is SECURITY INVOKER, and returns only the allowlisted JSON.
create function public.read_reviewer_history(p_scope_id uuid default null, p_before timestamptz default null, p_before_id uuid default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select learner_review.read_history(p_scope_id,p_before,p_before_id);
$$;
revoke all on all functions in schema learner_review from public, anon, authenticated;
revoke all on function public.read_reviewer_history(uuid,timestamptz,uuid) from public, anon, authenticated;
grant execute on function learner_review.read_history(uuid,timestamptz,uuid) to authenticated;
grant execute on function public.read_reviewer_history(uuid,timestamptz,uuid) to authenticated;
