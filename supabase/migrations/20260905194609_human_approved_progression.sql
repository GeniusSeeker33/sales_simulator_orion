-- Issue #23: manual staging/deployment only. No automatic initial level.
create schema learner_progression;
revoke all on schema learner_progression from public,anon,authenticated;
grant usage on schema learner_progression to authenticated;
create table learner_progression.reviews (
 id uuid primary key, sequence_no bigint generated always as identity unique,
 learner_binding_id uuid not null references public.learner_bindings(id),
 person_id uuid not null, employment_episode_id uuid not null,
 reviewer_user_id uuid not null references auth.users(id), author_scope_id uuid not null references learner_review.scopes(id),
 framework_version text not null check(framework_version='orion-sales/0.1-draft'),
 competency_version text not null check(competency_version='orion-sales/0.1-draft'),
 current_level text not null check(current_level in ('L1','L2','L3','L4','L5')),
 from_history_id uuid not null, observed_head_id uuid not null,
 outcome text not null check(outcome in ('remain_L1','advance_L1_to_L2','remain_L2','advance_L2_to_L3','remain_L3','advance_L3_to_L4','remain_L4','advance_L4_to_L5','remain_L5','defer_insufficient_evidence')),
 band_refs jsonb not null, supporting_refs jsonb not null,
 rationale text not null check(length(trim(rationale)) between 1 and 2000),
 development_plan text check(length(development_plan)<=2000),
 framework_requirements_confirmed boolean not null,
 reviewed_at timestamptz not null, created_at timestamptz not null default now(),
 status text not null default 'completed' check(status='completed'),
 revision integer not null check(revision>0),
 supersedes_id uuid unique references learner_progression.reviews(id), correction_reason text, request_hash text not null,
 check((supersedes_id is null and revision=1 and correction_reason is null) or
 (supersedes_id is not null and revision>1 and correction_reason is not null and length(trim(correction_reason)) between 1 and 500)),
 check(outcome like 'advance_%' or (development_plan is not null and length(trim(development_plan))>0))
);
create table learner_progression.level_history (
 id uuid primary key default gen_random_uuid(), sequence_no bigint generated always as identity unique,
 learner_binding_id uuid not null references public.learner_bindings(id), person_id uuid not null, employment_episode_id uuid not null,
 framework_version text not null check(framework_version='orion-sales/0.1-draft'),
 level text not null check(level in ('L1','L2','L3','L4','L5')),
 event_kind text not null check(event_kind in ('initial_confirmation','advancement','correction')),
 progression_review_id uuid unique references learner_progression.reviews(id),
 previous_history_id uuid unique references learner_progression.level_history(id),
 approved_by uuid not null references auth.users(id), author_scope_id uuid not null references learner_review.scopes(id),
 initial_approval_ref text, rationale text not null,
 source_environment text not null, source_project text not null,
 created_at timestamptz not null default now(),
 check((event_kind='initial_confirmation' and level='L1' and progression_review_id is null and previous_history_id is null and length(trim(initial_approval_ref)) between 1 and 500 and initial_approval_ref is not null)
 or (event_kind<>'initial_confirmation' and progression_review_id is not null and previous_history_id is not null and initial_approval_ref is null))
);
create unique index progression_one_initial on learner_progression.level_history(learner_binding_id) where event_kind='initial_confirmation';
alter table learner_progression.reviews add foreign key(from_history_id) references learner_progression.level_history(id);
alter table learner_progression.reviews add foreign key(observed_head_id) references learner_progression.level_history(id);
create index progression_review_history on learner_progression.reviews(learner_binding_id,sequence_no desc);
create index progression_level_history on learner_progression.level_history(learner_binding_id,sequence_no desc);
alter table learner_progression.reviews enable row level security;
alter table learner_progression.level_history enable row level security;
revoke all on all tables in schema learner_progression from public,anon,authenticated;
revoke all on all sequences in schema learner_progression from public,anon,authenticated;
create function learner_progression.prevent_change() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Progression reviews and history are append-only'; end; $$;
create trigger immutable_progression_review before update or delete on learner_progression.reviews for each row execute function learner_progression.prevent_change();
create trigger immutable_progression_history before update or delete on learner_progression.level_history for each row execute function learner_progression.prevent_change();

-- Administrator-only provisioning from a separately documented human L1 approval.
-- Not exposed as an RPC and NOT executable by authenticated users.
create function learner_progression.initialize(p_scope uuid,p_approval_ref text,p_rationale text) returns uuid
language plpgsql security definer set search_path='' as $$
declare g learner_review.scopes; b public.learner_bindings; v_id uuid;
begin
 select * into g from learner_review.scopes where id=p_scope and revoked_at is null and expires_at>statement_timestamp() and approved_at<=statement_timestamp() for share;
 if not found then raise exception 'Approved scope required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(g.learner_binding_id::text,23));
 select * into b from public.learner_bindings where id=g.learner_binding_id and revoked_at is null for share;
 if not found or b.auth_user_id=g.reviewer_user_id then raise exception 'Separate active learner required'; end if;
 if p_rationale is null or length(trim(p_rationale)) not between 1 and 2000 then raise exception 'Initial approval rationale required'; end if;
 if exists(select 1 from learner_progression.level_history where learner_binding_id=b.id) then raise exception 'Initial level already confirmed'; end if;
 insert into learner_progression.level_history(learner_binding_id,person_id,employment_episode_id,framework_version,level,event_kind,
 approved_by,author_scope_id,initial_approval_ref,rationale,source_environment,source_project)
 values(b.id,b.person_id,b.employment_episode_id,'orion-sales/0.1-draft','L1','initial_confirmation',g.reviewer_user_id,g.id,p_approval_ref,trim(p_rationale),b.source_environment,b.source_project) returning id into v_id;
 return v_id;
end; $$;

create function learner_progression.publish(p_id uuid,p_scope uuid,p_body jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_binding uuid; b public.learner_bindings; h learner_progression.level_history; prior learner_progression.reviews;
 r learner_band.reviews; c learner_competency.evidence; e jsonb; v_bands jsonb:='[]'; v_support jsonb:='[]';
 v_hash text; v_reviewed timestamptz; v_sup uuid; v_reason text; v_revision integer:=1;
 v_from text; v_from_id uuid; v_to text; v_outcome text; v_advance boolean; v_latest uuid; v_history boolean:=false;
begin
 if p_scope is null then raise exception 'Reviewer scope required' using errcode='42501'; end if;
 v_binding:=learner_coaching.authorized_binding(p_scope,false);
 -- Serialize all decisions for an episode, then recheck authorization under locks.
 perform pg_advisory_xact_lock(hashtextextended(v_binding::text,23));
 v_binding:=learner_coaching.authorized_binding(p_scope,true);
 select * into b from public.learner_bindings where id=v_binding;
 if p_id is null or jsonb_typeof(p_body) is distinct from 'object' then raise exception 'Invalid progression review'; end if;
 v_hash:=encode(sha256(convert_to(p_scope::text||p_body::text,'UTF8')),'hex');
 select * into prior from learner_progression.reviews where id=p_id;
 if found then
   if prior.reviewer_user_id=auth.uid() and prior.learner_binding_id=v_binding and prior.request_hash=v_hash then return p_id; end if;
   raise exception 'Submission ID conflict';
 end if;
 if exists(select 1 from jsonb_object_keys(p_body) x(k) where k not in
 ('framework_version','competency_version','expected_history_id','outcome','bands','supporting_evidence','rationale','development_plan','framework_requirements_confirmed','reviewed_at','supersedes_id','correction_reason')) then raise exception 'Unexpected progression field'; end if;
 if p_body->>'framework_version' is distinct from 'orion-sales/0.1-draft' or p_body->>'competency_version' is distinct from 'orion-sales/0.1-draft' then raise exception 'Unsupported framework/competency version'; end if;
 if jsonb_typeof(p_body->'rationale') is distinct from 'string' or jsonb_typeof(p_body->'framework_requirements_confirmed') is distinct from 'boolean' then raise exception 'Rationale and explicit framework confirmation required'; end if;
 v_reviewed:=(p_body->>'reviewed_at')::timestamptz;
 if v_reviewed is null or not isfinite(v_reviewed) or v_reviewed>statement_timestamp() then raise exception 'Invalid reviewed timestamp'; end if;
 select * into h from learner_progression.level_history where learner_binding_id=v_binding order by sequence_no desc limit 1;
 if not found then raise exception 'Verified initial level confirmation required; current level is unavailable'; end if;
 if h.id is distinct from (p_body->>'expected_history_id')::uuid then raise exception 'Current level history changed; refresh before deciding'; end if;
 v_from:=h.level; v_from_id:=h.id;
 v_sup:=nullif(p_body->>'supersedes_id','')::uuid; v_reason:=nullif(trim(p_body->>'correction_reason'),'');
 if v_sup is not null then
   select * into prior from learner_progression.reviews where id=v_sup;
   select id into v_latest from learner_progression.reviews where learner_binding_id=v_binding order by sequence_no desc limit 1;
   if prior.id is null or prior.learner_binding_id<>v_binding or prior.reviewer_user_id<>auth.uid() then raise exception 'Only original reviewer may correct this episode review' using errcode='42501'; end if;
   if v_latest<>prior.id then raise exception 'Only latest episode decision can be corrected; later decisions require separate reconsideration'; end if;
   if v_reason is null or length(v_reason)>500 then raise exception 'Correction reason required'; end if;
   v_from:=prior.current_level; v_from_id:=prior.from_history_id; v_revision:=prior.revision+1;
   v_history:=exists(select 1 from learner_progression.level_history where progression_review_id=prior.id);
 elsif v_reason is not null then raise exception 'Correction requires prior review'; end if;
 v_outcome:=p_body->>'outcome'; v_advance:=coalesce(v_outcome like 'advance_%',false);
 if v_outcome='defer_insufficient_evidence' or v_outcome='remain_'||v_from then v_to:=v_from;
 elsif v_from<>'L5' and v_outcome='advance_'||v_from||'_to_L'||((substring(v_from,2)::integer)+1)::text then v_to:='L'||((substring(v_from,2)::integer)+1)::text;
 else raise exception 'Explicit outcome must remain, defer, or advance one adjacent level from the approved baseline'; end if;
 if jsonb_typeof(p_body->'bands') is distinct from 'array' or jsonb_array_length(p_body->'bands')>15 then raise exception 'Band reference array required (at most one per competency)'; end if;
 for e in select value from jsonb_array_elements(p_body->'bands') order by value->>'id' loop
   if jsonb_typeof(e) is distinct from 'object' or not(e ?& array['id','revision']) or (select count(*) from jsonb_object_keys(e))<>2 then raise exception 'Exact band ID and revision required'; end if;
   select * into r from learner_band.reviews where id=(e->>'id')::uuid and learner_binding_id=v_binding for update;
   if not found or r.revision is distinct from (e->>'revision')::integer or exists(select 1 from learner_band.reviews where supersedes_id=r.id) then raise exception 'Band unavailable, wrong episode, or stale/superseded revision'; end if;
   if r.competency_version is distinct from p_body->>'competency_version' then raise exception 'Band version mismatch'; end if;
   if exists(select 1 from jsonb_array_elements(v_bands) x where x->>'competency_code'=r.competency_code) then raise exception 'Select one current review per competency'; end if;
   v_bands:=v_bands||jsonb_build_array(jsonb_build_object('id',r.id,'revision',r.revision,'competency_code',r.competency_code,'competency_version',r.competency_version,'outcome',r.outcome,'source_environment',r.source_environment,'source_project',r.source_project,'source_system','sales_simulator_orion','source_entity','competency_band_review'));
 end loop;
 -- Coverage validation does not compute a level or choose an outcome. Human checks all framework criteria.
 if v_advance and (jsonb_array_length(v_bands)<>15 or exists(select 1 from jsonb_array_elements(v_bands) x where x->>'outcome'='defer') or (p_body->>'framework_requirements_confirmed')::boolean is not true) then raise exception 'Advancement requires all 15 human band reviews and explicit confirmation of framework requirements'; end if;
 if jsonb_typeof(p_body->'supporting_evidence') is distinct from 'array' or jsonb_array_length(p_body->'supporting_evidence')>20 then raise exception 'Supporting reference array required'; end if;
 for e in select value from jsonb_array_elements(p_body->'supporting_evidence') order by value->>'id' loop
   if jsonb_typeof(e) is distinct from 'object' or not(e ?& array['id','revision']) or (select count(*) from jsonb_object_keys(e))<>2 then raise exception 'Exact human-reviewed evidence reference required'; end if;
   select * into c from learner_competency.evidence where id=(e->>'id')::uuid and learner_binding_id=v_binding for update;
   if not found or c.revision is distinct from (e->>'revision')::integer or exists(select 1 from learner_competency.evidence where supersedes_id=c.id) or c.competency_version is distinct from p_body->>'competency_version' then raise exception 'Supporting evidence unavailable or stale'; end if;
   if exists(select 1 from jsonb_array_elements(v_support) x where x->>'id'=c.id::text) then raise exception 'Duplicate supporting reference'; end if;
   v_support:=v_support||jsonb_build_array(jsonb_build_object('id',c.id,'revision',c.revision,'finding',c.finding,'source_type',c.source_type,'source_system','sales_simulator_orion','source_entity','competency_evidence','source_environment',b.source_environment,'source_project',b.source_project));
 end loop;
 insert into learner_progression.reviews(id,learner_binding_id,person_id,employment_episode_id,reviewer_user_id,author_scope_id,
 framework_version,competency_version,current_level,from_history_id,observed_head_id,outcome,band_refs,supporting_refs,rationale,development_plan,framework_requirements_confirmed,reviewed_at,revision,supersedes_id,correction_reason,request_hash)
 values(p_id,b.id,b.person_id,b.employment_episode_id,auth.uid(),p_scope,p_body->>'framework_version',p_body->>'competency_version',v_from,v_from_id,h.id,v_outcome,v_bands,v_support,trim(p_body->>'rationale'),nullif(trim(p_body->>'development_plan'),''),(p_body->>'framework_requirements_confirmed')::boolean,v_reviewed,v_revision,v_sup,v_reason,v_hash);
 if v_advance or v_history then
   insert into learner_progression.level_history(learner_binding_id,person_id,employment_episode_id,framework_version,level,event_kind,progression_review_id,previous_history_id,approved_by,author_scope_id,rationale,source_environment,source_project)
   values(b.id,b.person_id,b.employment_episode_id,p_body->>'framework_version',v_to,case when v_sup is not null then 'correction' else 'advancement' end,p_id,h.id,auth.uid(),p_scope,trim(p_body->>'rationale'),b.source_environment,b.source_project);
 end if;
 return p_id;
end; $$;

create function learner_progression.read_reviews(p_scope uuid,p_before bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_binding uuid; b public.learner_bindings; h learner_progression.level_history; v_rows jsonb; v_latest uuid;
begin
 v_binding:=learner_coaching.authorized_binding(p_scope,false);
 select * into b from public.learner_bindings where id=v_binding;
 select * into h from learner_progression.level_history where learner_binding_id=v_binding order by sequence_no desc limit 1;
 select id into v_latest from learner_progression.reviews where learner_binding_id=v_binding order by sequence_no desc limit 1;
 select coalesce(jsonb_agg(x.row order by x.sequence_no desc),'[]'::jsonb) into v_rows from (
 select c.sequence_no,jsonb_build_object('id',c.id,'sequence_no',c.sequence_no::text,'person_id',c.person_id,'employment_episode_id',c.employment_episode_id,
 'reviewer_user_id',c.reviewer_user_id,'framework_version',c.framework_version,'competency_version',c.competency_version,
 'current_level',c.current_level,'from_history_id',c.from_history_id,'observed_head_id',c.observed_head_id,'outcome',c.outcome,
 'bands',coalesce((select jsonb_agg(e||jsonb_build_object('superseded_by',(select n.id from learner_band.reviews n where n.supersedes_id=(e->>'id')::uuid))) from jsonb_array_elements(c.band_refs) e),'[]'::jsonb),
 'supporting_evidence',coalesce((select jsonb_agg(e||jsonb_build_object('superseded_by',(select n.id from learner_competency.evidence n where n.supersedes_id=(e->>'id')::uuid))) from jsonb_array_elements(c.supporting_refs) e),'[]'::jsonb),
 'rationale',c.rationale,'development_plan',c.development_plan,'framework_requirements_confirmed',c.framework_requirements_confirmed,
 'reviewed_at',c.reviewed_at,'created_at',c.created_at,'status',c.status,'revision',c.revision,'supersedes_id',c.supersedes_id,'correction_reason',c.correction_reason,
 'superseded_by',(select n.id from learner_progression.reviews n where n.supersedes_id=c.id),
 'can_correct',p_scope is not null and b.revoked_at is null and c.reviewer_user_id=auth.uid() and c.id=v_latest,
 'level_event',(select jsonb_build_object('id',l.id,'level',l.level,'event_kind',l.event_kind,'previous_history_id',l.previous_history_id,'created_at',l.created_at) from learner_progression.level_history l where l.progression_review_id=c.id)) as row
 from learner_progression.reviews c where c.learner_binding_id=v_binding and (p_before is null or c.sequence_no<p_before) order by c.sequence_no desc limit 51) x;
 return jsonb_build_object('records',v_rows,'person_id',b.person_id,'employment_episode_id',b.employment_episode_id,
 'current_level',h.level,'current_history_id',h.id,'can_create',p_scope is not null and b.revoked_at is null and b.auth_user_id<>auth.uid() and h.id is not null,
 'initial_confirmation',(select jsonb_build_object('id',l.id,'level',l.level,'approved_by',l.approved_by,'rationale',l.rationale,'created_at',l.created_at) from learner_progression.level_history l where l.learner_binding_id=v_binding and l.event_kind='initial_confirmation'));
end; $$;
create function public.publish_progression_review(p_id uuid,p_scope uuid,p_body jsonb) returns uuid language sql security invoker set search_path='' as $$ select learner_progression.publish(p_id,p_scope,p_body); $$;
create function public.read_progression_reviews(p_scope uuid default null,p_before bigint default null) returns jsonb language sql security invoker set search_path='' as $$ select learner_progression.read_reviews(p_scope,p_before); $$;
revoke all on all functions in schema learner_progression from public,anon,authenticated;
revoke all on function public.publish_progression_review(uuid,uuid,jsonb),public.read_progression_reviews(uuid,bigint) from public,anon,authenticated;
grant execute on function learner_progression.publish(uuid,uuid,jsonb),learner_progression.read_reviews(uuid,bigint) to authenticated;
grant execute on function public.publish_progression_review(uuid,uuid,jsonb),public.read_progression_reviews(uuid,bigint) to authenticated;
