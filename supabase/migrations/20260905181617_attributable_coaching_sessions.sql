-- Issue #20. Apply manually after staging approval; no automatic deployment.
create schema learner_coaching;
revoke all on schema learner_coaching from public, anon, authenticated;
grant usage on schema learner_coaching to authenticated;

create table learner_coaching.sessions (
  id uuid primary key,
  learner_binding_id uuid not null references public.learner_bindings(id),
  learner_auth_user_id uuid not null references auth.users(id),
  person_id uuid not null,
  employment_episode_id uuid not null,
  organization_scope text not null,
  role_scope_ref text not null,
  source_system text not null default 'sales_simulator_orion',
  source_entity text not null default 'coaching_session',
  source_environment text not null,
  source_project text not null,
  coach_user_id uuid not null references auth.users(id),
  author_scope_id uuid not null references learner_review.scopes(id),
  occurred_at timestamptz not null,
  competency_version text not null default 'orion-sales/0.1-draft',
  competency_targets text[] not null,
  evidence_refs jsonb not null,
  observed_behavior text not null,
  strengths text not null,
  development_opportunity text not null,
  next_action text not null,
  follow_up_on date,
  progress_status text not null check (progress_status in ('practiced','follow_up_pending','improving','demonstrated','reassess')),
  status text not null default 'completed' check (status='completed'),
  created_at timestamptz not null default now(),
  revision integer not null check (revision > 0),
  supersedes_id uuid unique references learner_coaching.sessions(id),
  correction_reason text,
  request_hash text not null,
  check ((supersedes_id is null and revision=1 and correction_reason is null)
    or (supersedes_id is not null and revision>1 and correction_reason is not null and length(trim(correction_reason)) between 1 and 500))
);
create index coaching_episode_history on learner_coaching.sessions(learner_binding_id,created_at desc,id desc);

create table learner_coaching.responses (
  id uuid primary key,
  session_id uuid not null references learner_coaching.sessions(id),
  learner_user_id uuid not null references auth.users(id),
  acknowledged_at timestamptz,
  comment text check (length(comment) <= 1500),
  created_at timestamptz not null default now(),
  request_hash text not null,
  check (acknowledged_at is not null or (comment is not null and length(trim(comment)) > 0))
);
create index coaching_response_session on learner_coaching.responses(session_id,created_at,id);
alter table learner_coaching.sessions enable row level security;
alter table learner_coaching.responses enable row level security;
revoke all on all tables in schema learner_coaching from public, anon, authenticated;

create function learner_coaching.prevent_change() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Published coaching and responses are append-only'; end; $$;
create trigger immutable_coaching before update or delete on learner_coaching.sessions for each row execute function learner_coaching.prevent_change();
create trigger immutable_response before update or delete on learner_coaching.responses for each row execute function learner_coaching.prevent_change();

-- Internal only. Writes lock both grant and binding so revocation is serialized with publication.
create function learner_coaching.authorized_binding(p_scope uuid, p_write boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_binding uuid; b public.learner_bindings;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_scope is null then
    if p_write then
      select * into b from public.learner_bindings where auth_user_id=v_user and revoked_at is null for share;
    else
      select * into b from public.learner_bindings where auth_user_id=v_user and revoked_at is null;
    end if;
    if not found then raise exception 'Learner access unavailable' using errcode='42501'; end if;
    return b.id;
  end if;
  if p_write then
    select g.learner_binding_id into v_binding from learner_review.scopes g
      where g.id=p_scope and g.reviewer_user_id=v_user and g.revoked_at is null
        and g.expires_at>statement_timestamp() and g.approved_at<=statement_timestamp() for share;
  else
    select g.learner_binding_id into v_binding from learner_review.scopes g
      where g.id=p_scope and g.reviewer_user_id=v_user and g.revoked_at is null
        and g.expires_at>statement_timestamp() and g.approved_at<=statement_timestamp();
  end if;
  if not found then raise exception 'Reviewer scope unavailable' using errcode='42501'; end if;
  if p_write then
    select * into b from public.learner_bindings where id=v_binding and revoked_at is null for share;
    if not found or b.auth_user_id=v_user then raise exception 'Active separate learner binding required' using errcode='42501'; end if;
  end if;
  return v_binding;
end; $$;

create function learner_coaching.publish(p_id uuid,p_scope uuid,p_body jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  v_binding uuid; b public.learner_bindings; prior learner_coaching.sessions;
  v_hash text; v_occurred timestamptz; v_follow date; v_targets text[]; v_revision integer:=1;
  v_supersedes uuid; v_reason text; v_refs jsonb:='[]'; e jsonb; r record; k text;
begin
  if p_scope is null then raise exception 'Reviewer scope required' using errcode='42501'; end if;
  v_binding:=learner_coaching.authorized_binding(p_scope,true);
  select * into b from public.learner_bindings where id=v_binding;
  if p_id is null or p_body is null or jsonb_typeof(p_body)<>'object' then raise exception 'Invalid coaching submission'; end if;
  v_hash:=encode(sha256(convert_to(p_scope::text||p_body::text,'UTF8')),'hex');
  select * into prior from learner_coaching.sessions where id=p_id;
  if found then
    if prior.coach_user_id=auth.uid() and prior.learner_binding_id=v_binding and prior.request_hash=v_hash then return prior.id; end if;
    raise exception 'Submission ID conflict';
  end if;
  if exists(select 1 from jsonb_object_keys(p_body) x(k) where x.k not in
    ('occurred_at','targets','evidence','observed_behavior','strengths','development_opportunity','next_action',
     'follow_up_on','progress_status','supersedes_id','correction_reason')) then raise exception 'Unexpected coaching field'; end if;
  foreach k in array array['observed_behavior','strengths','development_opportunity','next_action'] loop
    if jsonb_typeof(p_body->k) is distinct from 'string' or length(trim(p_body->>k)) not between 1 and 1500 then
      raise exception 'Concise coaching summaries are required';
    end if;
  end loop;
  v_occurred:=(p_body->>'occurred_at')::timestamptz;
  v_follow:=nullif(p_body->>'follow_up_on','')::date;
  if v_occurred is null or not isfinite(v_occurred) or v_occurred>statement_timestamp()
    or (v_follow is not null and (not isfinite(v_follow) or v_follow<(v_occurred at time zone 'UTC')::date)) then raise exception 'Invalid coaching dates'; end if;
  if jsonb_typeof(p_body->'targets') is distinct from 'array' then raise exception 'Competency targets required'; end if;
  select array_agg(value order by value) into v_targets from jsonb_array_elements_text(p_body->'targets');
  if cardinality(v_targets) is null or cardinality(v_targets) not between 1 and 15
    or exists(select 1 from unnest(v_targets) t where t is null or t !~ '^C(0[1-9]|1[0-5])$')
    or (select count(distinct t) from unnest(v_targets) t)<>cardinality(v_targets) then raise exception 'Invalid competency targets'; end if;
  if jsonb_typeof(p_body->'evidence') is distinct from 'array' then raise exception 'Evidence references required'; end if;
  if jsonb_array_length(p_body->'evidence') not between 1 and 20 then raise exception 'Select 1 to 20 evidence references'; end if;
  for e in select value from jsonb_array_elements(p_body->'evidence') loop
    if jsonb_typeof(e)<>'object' or not (e ?& array['kind','id','revision'])
      or (select count(*) from jsonb_object_keys(e))<>3 then raise exception 'Invalid evidence reference'; end if;
    if e->>'kind'='attempt' then
      select a.id,a.revision,a.source_system,a.source_entity,a.source_environment,a.source_project,a.status,a.scenario_ref
        into r from public.learner_training_attempts a where a.id=(e->>'id')::uuid
        and a.binding_id=v_binding and a.status<>'in_progress' for share;
    elsif e->>'kind'='simulation' then
      select s.id,s.revision,s.source_system,s.source_entity,s.source_environment,s.source_project,s.status,s.scenario_ref
        into r from public.learner_simulation_sessions s where s.id=(e->>'id')::uuid
        and s.binding_id=v_binding and s.status<>'in_progress' for share;
    else raise exception 'Invalid evidence kind'; end if;
    if not found or r.revision is distinct from (e->>'revision')::integer then raise exception 'Evidence unavailable, wrong episode, or changed revision'; end if;
    if exists(select 1 from jsonb_array_elements(v_refs) v where v->>'id'=r.id::text and v->>'kind'=e->>'kind') then raise exception 'Duplicate evidence reference'; end if;
    v_refs:=v_refs||jsonb_build_array(to_jsonb(r)||jsonb_build_object('kind',e->>'kind'));
  end loop;
  v_supersedes:=nullif(p_body->>'supersedes_id','')::uuid;
  v_reason:=nullif(trim(p_body->>'correction_reason'),'');
  if v_supersedes is not null then
    select * into prior from learner_coaching.sessions where id=v_supersedes for update;
    if not found or prior.learner_binding_id<>v_binding or prior.coach_user_id<>auth.uid() then raise exception 'Only original coach may correct this episode record' using errcode='42501'; end if;
    if exists(select 1 from learner_coaching.sessions where supersedes_id=v_supersedes) then raise exception 'Correct the latest version'; end if;
    if v_reason is null or length(v_reason)>500 then raise exception 'Correction reason required'; end if;
    v_revision:=prior.revision+1;
  elsif v_reason is not null then raise exception 'Correction must reference the prior version'; end if;
  insert into learner_coaching.sessions(id,learner_binding_id,learner_auth_user_id,person_id,employment_episode_id,
    organization_scope,role_scope_ref,source_environment,source_project,coach_user_id,author_scope_id,
    occurred_at,competency_targets,evidence_refs,observed_behavior,strengths,development_opportunity,next_action,
    follow_up_on,progress_status,revision,supersedes_id,correction_reason,request_hash)
  values(p_id,b.id,b.auth_user_id,b.person_id,b.employment_episode_id,b.organization_scope,b.role_scope_ref,
    b.source_environment,b.source_project,auth.uid(),p_scope,v_occurred,v_targets,v_refs,
    trim(p_body->>'observed_behavior'),trim(p_body->>'strengths'),trim(p_body->>'development_opportunity'),
    trim(p_body->>'next_action'),v_follow,p_body->>'progress_status',v_revision,v_supersedes,v_reason,v_hash);
  return p_id;
end; $$;

create function learner_coaching.respond(p_id uuid,p_session uuid,p_ack boolean,p_comment text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_binding uuid; c learner_coaching.sessions; r learner_coaching.responses; v_hash text;
begin
  v_binding:=learner_coaching.authorized_binding(null,true);
  select * into c from learner_coaching.sessions where id=p_session and learner_binding_id=v_binding for share;
  if not found then raise exception 'Coaching record unavailable' using errcode='42501'; end if;
  if p_id is null or p_ack is null or length(p_comment)>1500 then raise exception 'Invalid learner response'; end if;
  p_comment:=nullif(trim(p_comment),'');
  if not p_ack and p_comment is null then raise exception 'Acknowledge receipt or add a comment'; end if;
  v_hash:=encode(sha256(convert_to(jsonb_build_array(p_session,p_ack,p_comment)::text,'UTF8')),'hex');
  select * into r from learner_coaching.responses where id=p_id;
  if found then
    if r.learner_user_id=auth.uid() and r.request_hash=v_hash then return r.id; end if;
    raise exception 'Response ID conflict';
  end if;
  if exists(select 1 from learner_coaching.sessions where supersedes_id=c.id) then raise exception 'Respond to the latest coaching version'; end if;
  insert into learner_coaching.responses(id,session_id,learner_user_id,acknowledged_at,comment,request_hash)
    values(p_id,c.id,auth.uid(),case when p_ack then now() else null end,p_comment,v_hash);
  return p_id;
end; $$;

create function learner_coaching.read_sessions(p_scope uuid,p_before timestamptz,p_before_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_binding uuid; v_rows jsonb; b public.learner_bindings;
begin
  v_binding:=learner_coaching.authorized_binding(p_scope,false);
  select * into b from public.learner_bindings where id=v_binding;
  if (p_before is null)<>(p_before_id is null) then raise exception 'Incomplete cursor'; end if;
  select coalesce(jsonb_agg(x.row order by x.created_at desc,x.id desc),'[]'::jsonb) into v_rows from (
    select c.id,c.created_at,jsonb_build_object(
      'id',c.id,'person_id',c.person_id,'employment_episode_id',c.employment_episode_id,'coach_user_id',c.coach_user_id,
      'occurred_at',c.occurred_at,'competency_version',c.competency_version,'targets',c.competency_targets,
      'evidence',c.evidence_refs,'observed_behavior',c.observed_behavior,'strengths',c.strengths,
      'development_opportunity',c.development_opportunity,'next_action',c.next_action,'follow_up_on',c.follow_up_on,
      'progress_status',c.progress_status,'status',c.status,'created_at',c.created_at,'revision',c.revision,
      'supersedes_id',c.supersedes_id,'correction_reason',c.correction_reason,
      'superseded_by',(select n.id from learner_coaching.sessions n where n.supersedes_id=c.id),
      'can_correct',p_scope is not null and c.coach_user_id=auth.uid() and b.revoked_at is null
        and not exists(select 1 from learner_coaching.sessions n where n.supersedes_id=c.id),
      'responses',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'acknowledged_at',r.acknowledged_at,
        'comment',r.comment,'created_at',r.created_at) order by r.created_at,r.id)
        from learner_coaching.responses r where r.session_id=c.id),'[]'::jsonb)
    ) as row from learner_coaching.sessions c where c.learner_binding_id=v_binding
      and (p_before is null or (c.created_at,c.id)<(p_before,p_before_id))
    order by c.created_at desc,c.id desc limit 51
  ) x;
  return jsonb_build_object('records',v_rows,'can_create',p_scope is not null and b.revoked_at is null and b.auth_user_id<>auth.uid(),
    'person_id',b.person_id,'employment_episode_id',b.employment_episode_id);
end; $$;

create function public.publish_coaching_session(p_id uuid,p_scope uuid,p_body jsonb) returns uuid
language sql security invoker set search_path='' as $$ select learner_coaching.publish(p_id,p_scope,p_body); $$;
create function public.respond_to_coaching(p_id uuid,p_session uuid,p_ack boolean,p_comment text default null) returns uuid
language sql security invoker set search_path='' as $$ select learner_coaching.respond(p_id,p_session,p_ack,p_comment); $$;
create function public.read_coaching_sessions(p_scope uuid default null,p_before timestamptz default null,p_before_id uuid default null) returns jsonb
language sql security invoker set search_path='' as $$ select learner_coaching.read_sessions(p_scope,p_before,p_before_id); $$;
revoke all on all functions in schema learner_coaching from public, anon, authenticated;
revoke all on function public.publish_coaching_session(uuid,uuid,jsonb),public.respond_to_coaching(uuid,uuid,boolean,text),
  public.read_coaching_sessions(uuid,timestamptz,uuid) from public, anon, authenticated;
grant execute on function learner_coaching.publish(uuid,uuid,jsonb),learner_coaching.respond(uuid,uuid,boolean,text),
  learner_coaching.read_sessions(uuid,timestamptz,uuid) to authenticated;
grant execute on function public.publish_coaching_session(uuid,uuid,jsonb),public.respond_to_coaching(uuid,uuid,boolean,text),
  public.read_coaching_sessions(uuid,timestamptz,uuid) to authenticated;

-- Pin the exact evidence revisions displayed to reviewers; authorization unchanged.
create or replace function learner_review.read_history(p_scope_id uuid, p_before timestamptz, p_before_id uuid)
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
      'revision',a.revision,'id',a.id,'kind',a.kind,'scenario_ref',a.scenario_ref,'content_version',a.content_version,
      'status',a.status,'started_at',a.started_at,'ended_at',a.ended_at,
      'assessment_status',a.assessment_status,'criteria_version',a.criteria_version,
      'ai_overall',case when a.status='completed' and a.assessment_status='ai_unreviewed'
        then a.ai_score->'overall' else null end,
      'source_environment',a.source_environment,'source_project',a.source_project,
      'session',case when s.id is null then null else jsonb_build_object(
        'revision',s.revision,'id',s.id,'scenario_ref',s.scenario_ref,'difficulty_ref',s.difficulty_ref,
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
