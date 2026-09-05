-- Issue #22. Manual staging approval/deployment only.
create schema learner_band;
revoke all on schema learner_band from public,anon,authenticated;
grant usage on schema learner_band to authenticated;
create table learner_band.reviews (
 id uuid primary key,
 learner_binding_id uuid not null references public.learner_bindings(id),
 person_id uuid not null, employment_episode_id uuid not null,
 reviewer_user_id uuid not null references auth.users(id),
 author_scope_id uuid not null references learner_review.scopes(id),
 source_environment text not null, source_project text not null,
 competency_version text not null check(competency_version='orion-sales/0.1-draft'),
 competency_code text not null check(competency_code ~ '^C(0[1-9]|1[0-5])$'),
 outcome text not null check(outcome in ('B1','B2','B3','B4','B5','defer')),
 evidence_refs jsonb not null,
 rationale text not null check(length(trim(rationale)) between 1 and 2000),
 reviewed_at timestamptz not null,
 status text not null default 'completed' check(status='completed'),
 created_at timestamptz not null default now(), revision integer not null check(revision>0),
 supersedes_id uuid unique references learner_band.reviews(id), correction_reason text,
 request_hash text not null,
 check((supersedes_id is null and revision=1 and correction_reason is null) or
 (supersedes_id is not null and revision>1 and correction_reason is not null and length(trim(correction_reason)) between 1 and 500))
);
create index band_episode_history on learner_band.reviews(learner_binding_id,created_at desc,id desc);
alter table learner_band.reviews enable row level security;
revoke all on all tables in schema learner_band from public,anon,authenticated;
create function learner_band.prevent_change() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Band reviews are append-only'; end; $$;
create trigger immutable_band_review before update or delete on learner_band.reviews for each row execute function learner_band.prevent_change();

create function learner_band.publish(p_id uuid,p_scope uuid,p_body jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_binding uuid; b public.learner_bindings; prior learner_band.reviews; c learner_competency.evidence;
 v_hash text; v_reviewed timestamptz; e jsonb; v_refs jsonb:='[]'; v_substantive boolean:=false;
 v_sup uuid; v_reason text; v_revision integer:=1;
begin
 if p_scope is null then raise exception 'Reviewer scope required' using errcode='42501'; end if;
 v_binding:=learner_coaching.authorized_binding(p_scope,true);
 select * into b from public.learner_bindings where id=v_binding;
 if p_id is null or jsonb_typeof(p_body) is distinct from 'object' then raise exception 'Invalid band review'; end if;
 v_hash:=encode(sha256(convert_to(p_scope::text||p_body::text,'UTF8')),'hex');
 select * into prior from learner_band.reviews where id=p_id;
 if found then
   if prior.reviewer_user_id=auth.uid() and prior.learner_binding_id=v_binding and prior.request_hash=v_hash then return p_id; end if;
   raise exception 'Submission ID conflict';
 end if;
 if exists(select 1 from jsonb_object_keys(p_body) x(k) where k not in
 ('competency_version','competency_code','outcome','evidence','rationale','reviewed_at','supersedes_id','correction_reason')) then raise exception 'Unexpected review field'; end if;
 if p_body->>'competency_version' is distinct from 'orion-sales/0.1-draft' then raise exception 'Unsupported competency version'; end if;
 if jsonb_typeof(p_body->'rationale') is distinct from 'string' then raise exception 'Rationale required'; end if;
 v_reviewed:=(p_body->>'reviewed_at')::timestamptz;
 if v_reviewed is null or not isfinite(v_reviewed) or v_reviewed>statement_timestamp() then raise exception 'Invalid review timestamp'; end if;
 if jsonb_typeof(p_body->'evidence') is distinct from 'array' then raise exception 'Evidence array required'; end if;
 if jsonb_array_length(p_body->'evidence')>50 then raise exception 'At most 50 references per review'; end if;
 -- Deterministic source lock order; same row lock used by evidence supersession.
 for e in select value from jsonb_array_elements(p_body->'evidence') order by value->>'id' loop
   if jsonb_typeof(e) is distinct from 'object' or not(e ?& array['id','revision']) or
     (select count(*) from jsonb_object_keys(e))<>2 then raise exception 'Exact competency evidence ID and revision required'; end if;
   select * into c from learner_competency.evidence where id=(e->>'id')::uuid and learner_binding_id=v_binding for update;
   if not found or c.revision is distinct from (e->>'revision')::integer or
     exists(select 1 from learner_competency.evidence where supersedes_id=c.id) then raise exception 'Evidence unavailable, wrong episode, or stale/superseded revision'; end if;
   if c.competency_code is distinct from p_body->>'competency_code' or c.competency_version is distinct from p_body->>'competency_version' then raise exception 'Evidence must match competency and version'; end if;
   if exists(select 1 from jsonb_array_elements(v_refs) r where r->>'id'=c.id::text) then raise exception 'Duplicate evidence reference'; end if;
   v_substantive:=v_substantive or c.finding in ('supports','does_not_yet_support');
   v_refs:=v_refs||jsonb_build_array(jsonb_build_object('id',c.id,'revision',c.revision,'finding',c.finding,
     'source_type',c.source_type,'source_system','sales_simulator_orion','source_entity','competency_evidence',
     'source_environment',b.source_environment,'source_project',b.source_project));
 end loop;
 -- Sufficiency safeguard only: no band is calculated or recommended by this check.
 if p_body->>'outcome'<>'defer' and not v_substantive then raise exception 'Only non-scored or no evidence: defer until substantive human evidence exists'; end if;
 v_sup:=nullif(p_body->>'supersedes_id','')::uuid; v_reason:=nullif(trim(p_body->>'correction_reason'),'');
 if v_sup is not null then
   select * into prior from learner_band.reviews where id=v_sup for update;
   if not found or prior.learner_binding_id<>v_binding or prior.reviewer_user_id<>auth.uid() then raise exception 'Only original reviewer may correct this episode review' using errcode='42501'; end if;
   if prior.competency_code is distinct from p_body->>'competency_code' or prior.competency_version is distinct from p_body->>'competency_version' then raise exception 'Correction must retain competency and version'; end if;
   if exists(select 1 from learner_band.reviews where supersedes_id=v_sup) then raise exception 'Correct latest review revision'; end if;
   if v_reason is null or length(v_reason)>500 then raise exception 'Correction reason required'; end if;
   v_revision:=prior.revision+1;
 elsif v_reason is not null then raise exception 'Correction requires prior review'; end if;
 insert into learner_band.reviews(id,learner_binding_id,person_id,employment_episode_id,reviewer_user_id,author_scope_id,
 source_environment,source_project,competency_version,competency_code,outcome,evidence_refs,rationale,reviewed_at,revision,supersedes_id,correction_reason,request_hash)
 values(p_id,b.id,b.person_id,b.employment_episode_id,auth.uid(),p_scope,b.source_environment,b.source_project,
 p_body->>'competency_version',p_body->>'competency_code',p_body->>'outcome',v_refs,trim(p_body->>'rationale'),v_reviewed,v_revision,v_sup,v_reason,v_hash);
 return p_id;
end; $$;
create function learner_band.read_reviews(p_scope uuid,p_before timestamptz,p_before_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_binding uuid; b public.learner_bindings; v_rows jsonb;
begin
 v_binding:=learner_coaching.authorized_binding(p_scope,false);
 select * into b from public.learner_bindings where id=v_binding;
 if (p_before is null)<>(p_before_id is null) then raise exception 'Incomplete cursor'; end if;
 select coalesce(jsonb_agg(x.row order by x.created_at desc,x.id desc),'[]'::jsonb) into v_rows from (
 select c.id,c.created_at,jsonb_build_object('id',c.id,'learner_binding_id',c.learner_binding_id,'person_id',c.person_id,
 'employment_episode_id',c.employment_episode_id,'reviewer_user_id',c.reviewer_user_id,'competency_version',c.competency_version,
 'competency_code',c.competency_code,'outcome',c.outcome,'rationale',c.rationale,'reviewed_at',c.reviewed_at,'status',c.status,
 'created_at',c.created_at,'revision',c.revision,'supersedes_id',c.supersedes_id,'correction_reason',c.correction_reason,
 'evidence',coalesce((select jsonb_agg(e||jsonb_build_object('superseded_by',(select n.id from learner_competency.evidence n where n.supersedes_id=(e->>'id')::uuid))) from jsonb_array_elements(c.evidence_refs) e),'[]'::jsonb),
 'superseded_by',(select n.id from learner_band.reviews n where n.supersedes_id=c.id),
 'can_correct',p_scope is not null and b.revoked_at is null and c.reviewer_user_id=auth.uid() and
 not exists(select 1 from learner_band.reviews n where n.supersedes_id=c.id)) as row
 from learner_band.reviews c where c.learner_binding_id=v_binding and
 (p_before is null or (c.created_at,c.id)<(p_before,p_before_id)) order by c.created_at desc,c.id desc limit 51) x;
 return jsonb_build_object('records',v_rows,'can_create',p_scope is not null and b.revoked_at is null and b.auth_user_id<>auth.uid(),
 'person_id',b.person_id,'employment_episode_id',b.employment_episode_id);
end; $$;
create function public.publish_competency_band_review(p_id uuid,p_scope uuid,p_body jsonb) returns uuid
language sql security invoker set search_path='' as $$ select learner_band.publish(p_id,p_scope,p_body); $$;
create function public.read_competency_band_reviews(p_scope uuid default null,p_before timestamptz default null,p_before_id uuid default null) returns jsonb
language sql security invoker set search_path='' as $$ select learner_band.read_reviews(p_scope,p_before,p_before_id); $$;
revoke all on all functions in schema learner_band from public,anon,authenticated;
revoke all on function public.publish_competency_band_review(uuid,uuid,jsonb),public.read_competency_band_reviews(uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function learner_band.publish(uuid,uuid,jsonb),learner_band.read_reviews(uuid,timestamptz,uuid) to authenticated;
grant execute on function public.publish_competency_band_review(uuid,uuid,jsonb),public.read_competency_band_reviews(uuid,timestamptz,uuid) to authenticated;
