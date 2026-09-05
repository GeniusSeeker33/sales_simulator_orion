-- Issue #21: manual staging/deployment only. Private records, scoped RPC access.
create schema learner_competency;
revoke all on schema learner_competency from public, anon, authenticated;
grant usage on schema learner_competency to authenticated;
create table learner_competency.evidence (
 id uuid primary key,
 learner_binding_id uuid not null references public.learner_bindings(id),
 person_id uuid not null, employment_episode_id uuid not null,
 reviewer_user_id uuid not null references auth.users(id),
 author_scope_id uuid not null references learner_review.scopes(id),
 competency_version text not null check(competency_version='orion-sales/0.1-draft'),
 competency_code text not null check(competency_code ~ '^C(0[1-9]|1[0-5])$'),
 source_type text not null check(source_type in ('ai_practice','human_coaching','real_world_work')),
 evidence_ref jsonb not null,
 observed_behavior text not null check(length(trim(observed_behavior)) between 1 and 1500),
 finding text not null check(finding in ('supports','does_not_yet_support','insufficient_opportunity','technical_failure','disputed')),
 evidence_date date not null,
 created_at timestamptz not null default now(),
 revision integer not null check(revision>0),
 supersedes_id uuid unique references learner_competency.evidence(id),
 correction_reason text,
 request_hash text not null,
 check((supersedes_id is null and revision=1 and correction_reason is null) or
   (supersedes_id is not null and revision>1 and length(trim(correction_reason)) between 1 and 500 and correction_reason is not null))
);
create index competency_episode_history on learner_competency.evidence(learner_binding_id,created_at desc,id desc);
alter table learner_competency.evidence enable row level security;
revoke all on all tables in schema learner_competency from public,anon,authenticated;
create function learner_competency.prevent_change() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Competency evidence is append-only'; end; $$;
create trigger immutable_evidence before update or delete on learner_competency.evidence for each row execute function learner_competency.prevent_change();

create function learner_competency.publish(p_id uuid,p_scope uuid,p_body jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare b public.learner_bindings; v_binding uuid; prior learner_competency.evidence;
 e jsonb; r record; c learner_coaching.sessions; v_ref jsonb; v_hash text;
 v_date date; v_sup uuid; v_reason text; v_revision integer:=1;
begin
 if p_scope is null then raise exception 'Reviewer scope required' using errcode='42501'; end if;
 v_binding:=learner_coaching.authorized_binding(p_scope,true);
 select * into b from public.learner_bindings where id=v_binding;
 if p_id is null or jsonb_typeof(p_body) is distinct from 'object' then raise exception 'Invalid evidence submission'; end if;
 v_hash:=encode(sha256(convert_to(p_scope::text||p_body::text,'UTF8')),'hex');
 select * into prior from learner_competency.evidence where id=p_id;
 if found then
   if prior.reviewer_user_id=auth.uid() and prior.learner_binding_id=v_binding and prior.request_hash=v_hash then return p_id; end if;
   raise exception 'Submission ID conflict';
 end if;
 if exists(select 1 from jsonb_object_keys(p_body) x(k) where k not in
 ('competency_version','competency_code','source_type','evidence','observed_behavior','finding','evidence_date','supersedes_id','correction_reason')) then raise exception 'Unexpected evidence field'; end if;
 if p_body->>'competency_version' is distinct from 'orion-sales/0.1-draft' then raise exception 'Unsupported competency version'; end if;
 if jsonb_typeof(p_body->'observed_behavior') is distinct from 'string' then raise exception 'Observation required'; end if;
 v_date:=(p_body->>'evidence_date')::date;
 if v_date is null or not isfinite(v_date) or v_date>(statement_timestamp() at time zone 'UTC')::date then raise exception 'Invalid evidence date'; end if;
 e:=p_body->'evidence';
 if jsonb_typeof(e) is distinct from 'object' or not(e ?& array['kind','id','revision']) or
 (select count(*) from jsonb_object_keys(e))<>3 then raise exception 'One exact source reference required'; end if;
 if p_body->>'source_type'='ai_practice' then
   if e->>'kind'='attempt' then
     select a.id,a.revision,a.source_system,a.source_entity,a.source_environment,a.source_project,a.status,a.scenario_ref,a.content_version,a.kind,a.criteria_version,a.assessment_status
       into r from public.learner_training_attempts a where a.id=(e->>'id')::uuid and a.binding_id=v_binding and a.status<>'in_progress' for share;
   elsif e->>'kind'='simulation' then
     select a.id,a.revision,a.source_system,a.source_entity,a.source_environment,a.source_project,a.status,a.scenario_ref,a.content_version,a.training_attempt_id
       into r from public.learner_simulation_sessions a where a.id=(e->>'id')::uuid and a.binding_id=v_binding and a.status<>'in_progress' for share;
   else raise exception 'Invalid practice source'; end if;
   if not found or r.revision is distinct from (e->>'revision')::integer then raise exception 'Source unavailable, wrong episode, or stale revision'; end if;
   if r.status in ('technical_failure','abandoned') and p_body->>'finding' in ('supports','does_not_yet_support') then raise exception 'Unscored source requires non-scored finding'; end if;
   v_ref:=to_jsonb(r)||jsonb_build_object('kind',e->>'kind');
 elsif p_body->>'source_type'='human_coaching' then
   if e->>'kind' is distinct from 'coaching' then raise exception 'Coaching reference required'; end if;
   -- Same lock mode used by coaching correction; serialize against source supersession.
   select * into c from learner_coaching.sessions where id=(e->>'id')::uuid and learner_binding_id=v_binding for update;
   if not found or c.revision is distinct from (e->>'revision')::integer or
     exists(select 1 from learner_coaching.sessions where supersedes_id=c.id) then raise exception 'Source unavailable, wrong episode, or stale revision'; end if;
   if c.competency_version is distinct from p_body->>'competency_version' or not(p_body->>'competency_code'=any(c.competency_targets)) then raise exception 'Competency must match coaching target and version'; end if;
   v_ref:=jsonb_build_object('kind','coaching','id',c.id,'revision',c.revision,'source_system',c.source_system,
     'source_entity',c.source_entity,'source_environment',c.source_environment,'source_project',c.source_project,
     'status',c.status,'underlying_evidence',c.evidence_refs);
 else raise exception 'No governed real-world source is available; publication disabled'; end if;
 v_sup:=nullif(p_body->>'supersedes_id','')::uuid; v_reason:=nullif(trim(p_body->>'correction_reason'),'');
 if v_sup is not null then
   select * into prior from learner_competency.evidence where id=v_sup for update;
   if not found or prior.learner_binding_id<>v_binding or prior.reviewer_user_id<>auth.uid() then raise exception 'Only original reviewer may correct this episode record' using errcode='42501'; end if;
   if exists(select 1 from learner_competency.evidence where supersedes_id=v_sup) then raise exception 'Correct latest version'; end if;
   if v_reason is null or length(v_reason)>500 then raise exception 'Correction reason required'; end if;
   v_revision:=prior.revision+1;
 elsif v_reason is not null then raise exception 'Correction requires prior record'; end if;
 insert into learner_competency.evidence(id,learner_binding_id,person_id,employment_episode_id,reviewer_user_id,author_scope_id,
 competency_version,competency_code,source_type,evidence_ref,observed_behavior,finding,evidence_date,revision,supersedes_id,correction_reason,request_hash)
 values(p_id,b.id,b.person_id,b.employment_episode_id,auth.uid(),p_scope,p_body->>'competency_version',p_body->>'competency_code',
 p_body->>'source_type',v_ref,trim(p_body->>'observed_behavior'),p_body->>'finding',v_date,v_revision,v_sup,v_reason,v_hash);
 return p_id;
end; $$;

create function learner_competency.read_evidence(p_scope uuid,p_before timestamptz,p_before_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_binding uuid; b public.learner_bindings; v_rows jsonb;
begin
 v_binding:=learner_coaching.authorized_binding(p_scope,false);
 select * into b from public.learner_bindings where id=v_binding;
 if (p_before is null)<>(p_before_id is null) then raise exception 'Incomplete cursor'; end if;
 select coalesce(jsonb_agg(x.row order by x.created_at desc,x.id desc),'[]'::jsonb) into v_rows from (
 select c.id,c.created_at,jsonb_build_object('id',c.id,'learner_binding_id',c.learner_binding_id,'person_id',c.person_id,
 'employment_episode_id',c.employment_episode_id,'reviewer_user_id',c.reviewer_user_id,'competency_version',c.competency_version,
 'competency_code',c.competency_code,'source_type',c.source_type,'evidence',c.evidence_ref,'observed_behavior',c.observed_behavior,
 'finding',c.finding,'evidence_date',c.evidence_date,'created_at',c.created_at,'revision',c.revision,'supersedes_id',c.supersedes_id,
 'correction_reason',c.correction_reason,'superseded_by',(select n.id from learner_competency.evidence n where n.supersedes_id=c.id),
 'source_superseded_by',case when c.source_type='human_coaching' then (select n.id from learner_coaching.sessions n where n.supersedes_id=(c.evidence_ref->>'id')::uuid) else null end,
 'can_correct',p_scope is not null and b.revoked_at is null and c.reviewer_user_id=auth.uid() and
 not exists(select 1 from learner_competency.evidence n where n.supersedes_id=c.id)) as row
 from learner_competency.evidence c where c.learner_binding_id=v_binding and
 (p_before is null or (c.created_at,c.id)<(p_before,p_before_id)) order by c.created_at desc,c.id desc limit 51) x;
 return jsonb_build_object('records',v_rows,'can_create',p_scope is not null and b.revoked_at is null and b.auth_user_id<>auth.uid(),
 'person_id',b.person_id,'employment_episode_id',b.employment_episode_id);
end; $$;
create function public.publish_competency_evidence(p_id uuid,p_scope uuid,p_body jsonb) returns uuid
language sql security invoker set search_path='' as $$ select learner_competency.publish(p_id,p_scope,p_body); $$;
create function public.read_competency_evidence(p_scope uuid default null,p_before timestamptz default null,p_before_id uuid default null) returns jsonb
language sql security invoker set search_path='' as $$ select learner_competency.read_evidence(p_scope,p_before,p_before_id); $$;
revoke all on all functions in schema learner_competency from public,anon,authenticated;
revoke all on function public.publish_competency_evidence(uuid,uuid,jsonb),public.read_competency_evidence(uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function learner_competency.publish(uuid,uuid,jsonb),learner_competency.read_evidence(uuid,timestamptz,uuid) to authenticated;
grant execute on function public.publish_competency_evidence(uuid,uuid,jsonb),public.read_competency_evidence(uuid,timestamptz,uuid) to authenticated;
