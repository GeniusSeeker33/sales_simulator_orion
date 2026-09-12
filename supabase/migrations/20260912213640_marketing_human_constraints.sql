begin;
-- Immutable whole-set versions keep edits/removals attributable without mutable active flags.
create table marketing.human_constraint_sets (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, campaign_id uuid not null,
 asset_id uuid not null references marketing.assets(id), orchestration_id uuid references marketing.task_orchestrations(id),
 created_by uuid not null references auth.users(id), source_revision integer not null,
 source_decision_id bigint references marketing.workflow_history(id),
 supersedes_id uuid unique references marketing.human_constraint_sets(id),
 constraints jsonb not null check(jsonb_typeof(constraints)='array'), created_at timestamptz not null default now(),
 foreign key(workspace_id,campaign_id) references marketing.campaigns(workspace_id,id)
);
create index human_constraints_asset on marketing.human_constraint_sets(workspace_id,asset_id);
create unique index human_constraints_root on marketing.human_constraint_sets(asset_id) where supersedes_id is null;
create index human_constraints_orchestration on marketing.human_constraint_sets(orchestration_id);
alter table marketing.human_constraint_sets enable row level security;
revoke all on marketing.human_constraint_sets from public,anon,authenticated,service_role;
create trigger immutable_human_constraints before update or delete on marketing.human_constraint_sets
 for each row execute function marketing.prevent_audit_mutation();
alter table marketing.task_orchestrations add column constraint_preflight jsonb not null default '[]';

create function marketing.applicable_constraint_sets(p_workspace uuid,p_asset uuid,p_orchestration uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) from marketing.human_constraint_sets s
 where s.workspace_id=p_workspace and (s.asset_id=p_asset or s.orchestration_id=p_orchestration)
 and not exists(select 1 from marketing.human_constraint_sets newer where newer.supersedes_id=s.id)
$$;
create function marketing.normalize_constraint_text(p_text text) returns text
language sql immutable set search_path='' as $$ select trim(regexp_replace(lower(coalesce(p_text,'')),'[^[:alnum:]]+',' ','g')) $$;

-- This is the authoritative preflight, shared by generation, QA, reads and approval.
create function marketing.evaluate_human_constraints(p_content text,p_sets jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb:='[]'; c jsonb; normalized text:=marketing.normalize_constraint_text(p_content);
 term text; matched text; position integer; failed boolean; semantic boolean; detail text; tokens text[]; host text; destination_found boolean;
begin
 for c in select v from jsonb_array_elements(p_sets) s cross join lateral jsonb_array_elements(s->'constraints') v loop
  failed:=false; semantic:=false; matched:=null; position:=null;
  term:=marketing.normalize_constraint_text(c->>'value');
  if c->>'constraint_type' in ('prohibited_phrase','prohibited_claim','required_phrase_or_concept') then
   position:=strpos(' '||normalized||' ',' '||term||' ');
   if c->>'constraint_type'='required_phrase_or_concept' then
    if c->'details'->>'mode'='concept' then semantic:=position=0; else failed:=position=0; end if;
    detail:='Required phrase/concept: '||(c->>'value');
   else
    failed:=position>0; semantic:=not failed and c->>'constraint_type'='prohibited_claim';
    detail:='Prohibited phrase/claim: '||(c->>'value');
   end if;
   if position>0 then matched:=term; end if;
  elsif c->>'constraint_type'='required_destination' then
   host:=regexp_replace(lower(c->>'value'),'^www\.',''); destination_found:=false;
   -- Same bounded hostname extraction as Guardian QA v2: whole host, no credential URLs.
   for tokens in select regexp_matches(lower(p_content),'(?:https?://|www\.)[^\s<>()[\]"'']+|\m[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}(?:/[^\s<>()[\]"'']*)?','g') loop
    term:=regexp_replace(tokens[1],'[.,;:!?]+$','');
    if strpos(term,'@')>0 then continue; end if;
    term:=regexp_replace(term,'^https?://',''); term:=split_part(split_part(split_part(split_part(term,'/',1),'?',1),'#',1),':',1);
    term:=regexp_replace(regexp_replace(term,'^www\.',''),'\.$','');
    if term=host then destination_found:=true; end if;
   end loop;
   failed:=not destination_found; detail:='Required destination hostname: '||host;
  else
   tokens:=case c->>'constraint_type'
    when 'no_unverified_comparative_claim' then array['competitive','best','leading','leader','superior']
    when 'no_unverified_outcome_claim' then array['grow your business','success','increase sales','improve profit','outperform','win']
    else array['testimonial','testimonials','customer says','dealer says','satisfied dealer'] end;
   foreach term in array tokens loop
    position:=strpos(' '||normalized||' ',' '||term||' ');
    if position>0 then failed:=true; matched:=term; exit; end if;
   end loop;
   if c->>'constraint_type'='no_fabricated_testimonial' and not failed then
    failed:=p_content ~* '["“][^"”]{3,250}["”][[:space:]]*[-—][^\n]{0,100}(dealer|customer)';
    if failed then matched:='Quoted dealer/customer endorsement'; end if;
   end if;
   semantic:=not failed;
   detail:=case c->>'constraint_type' when 'no_fabricated_testimonial' then 'No fabricated testimonials (no approved testimonial evidence is linked)'
    when 'no_unverified_comparative_claim' then 'No unverified comparative claims' else 'No unverified business-outcome claims' end;
  end if;
  result:=result||jsonb_build_array(jsonb_build_object('rule','human_constraint:'||(c->>'id'),'constraint_id',c->>'id',
   'constraint_type',c->>'constraint_type','passed',not failed,'review_required',semantic,
   'detail',detail,'matched_text',matched,'normalized_offset',case when position>0 then position else null end,
   'excerpt',case when position>0 then substring(normalized from greatest(1,position-40) for 160) else null end,
   'qa_version','human-constraints-v1'));
 end loop;
 return result;
end $$;

create function public.save_marketing_human_constraints(p_workspace uuid,p_asset uuid,p_expected_revision integer,p_expected_set uuid,p_constraints jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a marketing.assets; prior marketing.human_constraint_sets; saved marketing.human_constraint_sets; item jsonb; entries jsonb:='[]'; cid uuid; oid uuid;
begin
 if not marketing.has_membership(p_workspace,array['contributor','approver','admin']) then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 select * into a from marketing.assets where workspace_id=p_workspace and id=p_asset for update;
 if not found or a.revision is distinct from p_expected_revision or a.publication_state<>'unpublished' or a.approval_state not in ('draft','changes_requested') then raise exception 'Asset changed or not editable'; end if;
 select * into prior from marketing.human_constraint_sets s where s.asset_id=a.id and not exists(select 1 from marketing.human_constraint_sets n where n.supersedes_id=s.id);
 if prior.id is distinct from p_expected_set then raise exception 'Constraints changed; refresh'; end if;
 if jsonb_typeof(p_constraints) is distinct from 'array' or jsonb_array_length(p_constraints)>30 then raise exception 'Invalid constraints'; end if;
 for item in select value from jsonb_array_elements(p_constraints) loop
  if jsonb_typeof(item) is distinct from 'object' or exists(select 1 from jsonb_object_keys(item) k where k not in ('constraint_type','value','rationale','details'))
   or coalesce(item->>'constraint_type','') not in ('prohibited_phrase','prohibited_claim','required_phrase_or_concept','required_destination','no_fabricated_testimonial','no_unverified_comparative_claim','no_unverified_outcome_claim')
   or (item ? 'rationale' and (jsonb_typeof(item->'rationale') is distinct from 'string' or length(item->>'rationale')>1000)) then raise exception 'Invalid constraint'; end if;
  if item->>'constraint_type' in ('prohibited_phrase','prohibited_claim','required_phrase_or_concept','required_destination') then
   if jsonb_typeof(item->'value') is distinct from 'string' or length(marketing.normalize_constraint_text(item->>'value')) not between 1 and 240 then raise exception 'Constraint value required'; end if;
  elsif coalesce(item->>'value','')<>'' then raise exception 'Toggle cannot contain a value'; end if;
  if item->>'constraint_type'='required_destination' and lower(item->>'value') !~ '^(www\.)?[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$' then raise exception 'Destination must be a hostname'; end if;
  if item ? 'details' and (item->>'constraint_type'<>'required_phrase_or_concept' or jsonb_typeof(item->'details') is distinct from 'object'
   or exists(select 1 from jsonb_object_keys(item->'details') k where k<>'mode') or coalesce(item->'details'->>'mode','') not in ('phrase','concept')) then raise exception 'Invalid constraint details'; end if;
  select (v->>'id')::uuid into cid from jsonb_array_elements(coalesce(prior.constraints,'[]')) v where v-'id'=item limit 1;
  entries:=entries||jsonb_build_array(item||jsonb_build_object('id',coalesce(cid,gen_random_uuid())));
 end loop;
 if (select count(distinct v-'id') from jsonb_array_elements(entries) v)<>jsonb_array_length(entries) then raise exception 'Duplicate constraints'; end if;
 select id into oid from marketing.task_orchestrations where workspace_id=p_workspace and asset_id=a.id order by started_at desc limit 1;
 insert into marketing.human_constraint_sets(workspace_id,campaign_id,asset_id,orchestration_id,created_by,source_revision,source_decision_id,supersedes_id,constraints)
 values(p_workspace,a.campaign_id,a.id,oid,auth.uid(),a.revision,
  (select id from marketing.workflow_history where asset_id=a.id and actor_type='human' and action='changes_requested' and (snapshot->>'revision')::integer=a.revision order by id desc limit 1),prior.id,entries) returning * into saved;
 return to_jsonb(saved);
end $$;

-- Guard the common private asset pathway, including direct human RPCs and agent submit.
alter function marketing.write_asset_internal(uuid,uuid,uuid,integer,text,jsonb,text,uuid) rename to write_asset_internal_before_constraints;
create function marketing.write_asset_internal(p_workspace uuid,p_campaign uuid,p_id uuid,p_expected_revision integer,p_action text,p_payload jsonb,p_actor_type text,p_agent_run uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare a marketing.assets; checks jsonb;
begin
 if not marketing.has_membership(p_workspace,array['contributor','approver','admin']) then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 if p_action in ('submit','approve') then
  select * into a from marketing.assets where workspace_id=p_workspace and campaign_id=p_campaign and id=p_id for update;
  checks:=marketing.evaluate_human_constraints(a.content,marketing.applicable_constraint_sets(p_workspace,p_id));
  if exists(select 1 from jsonb_array_elements(checks) q where q->>'passed'='false') then raise exception 'Human constraint failed; revise the asset or explicitly supersede constraints'; end if;
 end if;
 return marketing.write_asset_internal_before_constraints(p_workspace,p_campaign,p_id,p_expected_revision,p_action,p_payload,p_actor_type,p_agent_run);
end $$;
create or replace function public.write_marketing_asset(p_workspace uuid,p_campaign uuid,p_id uuid,p_expected_revision integer,p_action text,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if p_action='request_changes' and p_payload ? 'human_constraints' then
  result:=marketing.write_asset_internal(p_workspace,p_campaign,p_id,p_expected_revision,p_action,p_payload-array['human_constraints','constraint_set_id'],'human',null);
  perform public.save_marketing_human_constraints(p_workspace,p_id,p_expected_revision+1,(p_payload->>'constraint_set_id')::uuid,p_payload->'human_constraints');
 else result:=marketing.write_asset_internal(p_workspace,p_campaign,p_id,p_expected_revision,p_action,p_payload,'human',null); end if;
 return result;
end $$;

-- Enrich before INSERT so immutable run snapshots and returned model context agree.
create function marketing.attach_human_constraints() returns trigger language plpgsql security definer set search_path='' as $$
declare sets jsonb; aid uuid; oid uuid;
begin
 aid:=(new.input_metadata->'asset'->>'id')::uuid; oid:=(new.input_metadata->'orchestration'->>'id')::uuid;
 sets:=marketing.applicable_constraint_sets(new.workspace_id,aid,oid);
 new.input_metadata:=new.input_metadata||jsonb_build_object('human_constraint_sets',sets,
  'human_constraints',coalesce((select jsonb_agg(v) from jsonb_array_elements(sets) s cross join lateral jsonb_array_elements(s->'constraints') v),'[]'::jsonb),
  'prior_human_change_requests',coalesce((select jsonb_agg(to_jsonb(h)) from
   (select id,notes,snapshot->'revision' as asset_revision,actor_user_id,occurred_at from marketing.workflow_history
    where workspace_id=new.workspace_id and asset_id=aid and actor_type='human' and action='changes_requested' order by id desc limit 3) h),'[]'::jsonb),
  'constraint_preflight',marketing.evaluate_human_constraints(new.input_metadata->'asset'->>'content',sets),
  'creator_preflight',coalesce(new.input_metadata->'orchestration'->'constraint_preflight','[]'::jsonb));
 if octet_length(new.input_metadata::text)>200000 then raise exception 'Campaign context too large'; end if;
 return new;
end $$;
create trigger attach_human_constraints before insert on marketing.agent_runs for each row execute function marketing.attach_human_constraints();
alter function public.start_marketing_agent_run(uuid,uuid,jsonb,text,text) rename to start_marketing_agent_run_before_constraints;
alter function public.start_marketing_agent_run_before_constraints(uuid,uuid,jsonb,text,text) set schema marketing;
create function public.start_marketing_agent_run(p_id uuid,p_human uuid,p_request jsonb,p_version text,p_model text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform marketing.start_marketing_agent_run_before_constraints(p_id,p_human,p_request,p_version,p_model);
 return (select input_metadata from marketing.agent_runs where id=p_id);
end $$;

create or replace function public.finish_marketing_agent_run(p_id uuid,p_output jsonb,p_qa jsonb,p_usage jsonb,p_error text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r marketing.agent_runs; c marketing.campaigns; a marketing.assets; asset_id uuid; failure text:=p_error; previous_sub text; previous_claims text;
begin
 select * into r from marketing.agent_runs where id=p_id for update;
 if not found then raise exception 'Agent run unavailable'; end if;
 if r.status<>'started' then return to_jsonb(r); end if;
 if r.instruction_version is null or r.instruction_version not in ('marketing-v1','marketing-v2') then raise exception 'Unsupported agent run'; end if;
 if failure is null then
  -- Subtransaction: any validation/write failure rolls back ALL result mutations.
  begin
   perform 1 from marketing.workspace_members where workspace_id=r.workspace_id and user_id=r.initiated_by and role in ('contributor','approver','admin') for share;
   if not found then raise exception 'Permission revoked'; end if;
   select * into c from marketing.campaigns where workspace_id=r.workspace_id and id=r.campaign_id for share;
   if not found or c.revision<>(r.input_metadata->'campaign'->>'revision')::integer then raise exception 'Campaign changed'; end if;
   if r.started_at < now()-interval '2 minutes' then raise exception 'Run expired'; end if;
   if p_output is null or jsonb_typeof(p_output)<>'object' or octet_length(p_output::text)>100000 then raise exception 'Invalid output'; end if;
   if r.input_metadata ? 'orchestration' then
    perform 1 from marketing.task_orchestrations o join marketing.campaign_tasks t on t.id=o.task_id
     where o.active_run_id=r.id and o.state in ('strategist_running','creator_running','guardian_running') and t.revision=o.task_revision for share of o,t;
    if not found then raise exception 'Task orchestration changed'; end if;
   end if;
   if r.agent_key='creator' then
    if exists(select 1 from jsonb_object_keys(p_output) k where k not in ('name','asset_type','content'))
      or jsonb_typeof(p_output->'name') is distinct from 'string' or jsonb_typeof(p_output->'content') is distinct from 'string'
      or length(trim(coalesce(p_output->>'content',''))) not between 1 and 50000
      or p_output->>'asset_type' is distinct from r.input_metadata->'request'->>'asset_type' then raise exception 'Invalid Creator output'; end if;
    -- Existing private helper requires caller-attributed auth.uid(). Set only within this trusted RPC.
    previous_sub:=current_setting('request.jwt.claim.sub',true);
    previous_claims:=current_setting('request.jwt.claims',true);
    perform set_config('request.jwt.claim.sub',r.initiated_by::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',r.initiated_by)::text,true);
    if r.input_metadata->'request' ? 'revision_asset_id' then
     select * into a from marketing.assets where workspace_id=r.workspace_id and campaign_id=r.campaign_id
      and id=(r.input_metadata->'request'->>'revision_asset_id')::uuid for update;
     if not found or a.revision is distinct from (r.input_metadata->'asset'->>'revision')::integer
      or a.created_via<>'agent' or (a.approval_state<>'changes_requested' and not(r.input_metadata ? 'orchestration' and a.approval_state='draft')) or a.publication_state<>'unpublished'
      then raise exception 'Asset revision changed'; end if;
     asset_id:=a.id;
     perform marketing.write_asset_as_agent(r.workspace_id,r.campaign_id,asset_id,a.revision,'save',p_output,r.id);
    else
     asset_id:=gen_random_uuid();
     perform marketing.write_asset_as_agent(r.workspace_id,r.campaign_id,asset_id,null,'save',p_output,r.id);
     update marketing.assets set agent_run_id=r.id where id=asset_id;
    end if;
    if (r.input_metadata->'request'->>'submit_for_review')::boolean then
     perform marketing.write_asset_as_agent(r.workspace_id,r.campaign_id,asset_id,coalesce(a.revision,0)+1,'submit','{}',r.id);
    end if;
    perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
    perform set_config('request.jwt.claims',coalesce(previous_claims,''),true);
   elsif r.agent_key='guardian' then
    select * into a from marketing.assets where workspace_id=r.workspace_id and campaign_id=r.campaign_id and id=(r.input_metadata->'asset'->>'id')::uuid for share;
    if not found or a.revision<>(r.input_metadata->'asset'->>'revision')::integer then raise exception 'Asset changed'; end if;
    if coalesce(p_output->>'recommendation','') not in ('ready_for_human_review','needs_changes')
      or exists(select 1 from jsonb_object_keys(p_output) k where k not in ('summary','recommendation','findings','constraint_evaluations')) then raise exception 'Invalid Guardian output'; end if;
   elsif r.agent_key='strategist' then
    if exists(select 1 from jsonb_object_keys(p_output) k where k not in ('summary','steps','proposed_tasks'))
      or jsonb_typeof(p_output->'steps') is distinct from 'array' or jsonb_typeof(p_output->'proposed_tasks') is distinct from 'array' then raise exception 'Invalid Strategist output'; end if;
   else raise exception 'Unknown agent'; end if;
  exception when others then
   failure:='result_rejected'; asset_id:=null;
  end;
 end if;
 if failure is not null and failure not in ('model_failed','invalid_output','persistence_failed','result_rejected') then failure:='model_failed'; end if;
 update marketing.agent_runs set status=case when failure is null then 'succeeded' else 'failed' end,ended_at=now(),
  output_metadata=case when failure is null then jsonb_build_object('result',p_output,'deterministic_qa',p_qa) else '{}'::jsonb end,
  usage=coalesce(p_usage,'{}'),error_code=failure,outcome_asset_id=asset_id where id=r.id returning * into r;
 return to_jsonb(r);
end $$;



alter function public.finish_marketing_agent_run(uuid,jsonb,jsonb,jsonb,text) rename to finish_marketing_agent_run_before_constraints;
alter function public.finish_marketing_agent_run_before_constraints(uuid,jsonb,jsonb,jsonb,text) set schema marketing;
create function public.finish_marketing_agent_run(p_id uuid,p_output jsonb,p_qa jsonb,p_usage jsonb,p_error text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r marketing.agent_runs; sets jsonb; checks jsonb:='[]'; evaluations jsonb; failure text:=p_error;
begin
 select * into r from marketing.agent_runs where id=p_id for update;
 if not found then raise exception 'Agent run unavailable'; end if;
 if r.status<>'started' then return to_jsonb(r); end if;
 perform 1 from marketing.assets where id=(r.input_metadata->'asset'->>'id')::uuid for share;
 sets:=marketing.applicable_constraint_sets(r.workspace_id,(r.input_metadata->'asset'->>'id')::uuid,(r.input_metadata->'orchestration'->>'id')::uuid);
 if failure is null then
  if sets is distinct from coalesce(r.input_metadata->'human_constraint_sets','[]'::jsonb) then failure:='result_rejected';
  elsif r.agent_key in ('creator','guardian') then
   checks:=marketing.evaluate_human_constraints(case when r.agent_key='creator' then p_output->>'content' else r.input_metadata->'asset'->>'content' end,sets);
   if r.agent_key='guardian' then
    evaluations:=coalesce(p_output->'constraint_evaluations','[]'::jsonb);
    if jsonb_typeof(evaluations) is distinct from 'array' then failure:='invalid_output';
    elsif jsonb_array_length(evaluations)<>jsonb_array_length(checks)
     or (select count(distinct v->>'constraint_id') from jsonb_array_elements(evaluations) v)<>jsonb_array_length(checks)
     or exists(select 1 from jsonb_array_elements(evaluations) v where coalesce(v->>'status','') not in ('satisfied','violated','semantic_review')
       or not exists(select 1 from jsonb_array_elements(checks) q where q->>'constraint_id'=v->>'constraint_id')) then failure:='invalid_output';
    else
     evaluations:=coalesce((select jsonb_agg(case when q->>'passed'='false' then v||jsonb_build_object('status','violated','detail',q->>'detail') else v end)
      from jsonb_array_elements(evaluations) v join jsonb_array_elements(checks) q on q->>'constraint_id'=v->>'constraint_id'),'[]'::jsonb);
     p_output:=p_output||jsonb_build_object('constraint_evaluations',evaluations);
     if exists(select 1 from jsonb_array_elements(checks) q where q->>'passed'='false') or exists(select 1 from jsonb_array_elements(evaluations) v where v->>'status'='violated') then
      p_output:=p_output||jsonb_build_object('recommendation','needs_changes');
     end if;
    end if;
   end if;
  end if;
 end if;
 return marketing.finish_marketing_agent_run_before_constraints(p_id,p_output,
  coalesce((select jsonb_agg(q) from jsonb_array_elements(coalesce(p_qa,'[]')) q where not(q ? 'constraint_id')),'[]'::jsonb)||checks,p_usage,failure);
end $$;
create or replace function public.finish_marketing_orchestration_stage(p_id uuid,p_run uuid,p_output jsonb,p_qa jsonb,p_usage jsonb,p_error text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o marketing.task_orchestrations; r jsonb; failure text:=p_error; t marketing.campaign_tasks;
begin
 select * into o from marketing.task_orchestrations where id=p_id for update;
 if not found then raise exception 'Orchestration unavailable'; end if;
 if o.active_run_id is distinct from p_run or o.state not in ('strategist_running','creator_running','guardian_running') then
  -- A lost Creator completion response may have committed the next stage, but no caller
  -- owns permission to execute it. Never replay inference or silently leave it running.
  if p_error is not null and p_run=any(o.run_ids) and o.state in ('strategist_running','creator_running','guardian_running') then
   perform public.finish_marketing_agent_run(o.active_run_id,null,'[]','{}','persistence_failed');
   update marketing.task_orchestrations set state='blocked',reason='Stage handoff outcome uncertain; inspect before restarting',completed_at=now(),revision=revision+1,updated_at=now(),last_actor_user_id=null where id=o.id returning * into o;
  end if;
  return jsonb_build_object('orchestration',to_jsonb(o));
 end if;
 select * into t from marketing.campaign_tasks where id=o.task_id for share;
 if t.revision<>o.task_revision then failure:='result_rejected'; end if;
 r:=public.finish_marketing_agent_run(p_run,p_output,p_qa,p_usage,failure);
 if r->>'status'<>'succeeded' then
  update marketing.task_orchestrations set state='failed',reason=coalesce(r->>'error_code','Stage failed'),completed_at=now(),revision=revision+1,updated_at=now(),last_actor_user_id=null where id=o.id returning * into o;
 elsif o.state='strategist_running' then
  update marketing.task_orchestrations set state='awaiting_plan',plan_run_id=p_run,revision=revision+1,updated_at=now(),last_actor_user_id=null where id=o.id returning * into o;
 elsif o.state='creator_running' then
  update marketing.task_orchestrations set asset_id=(r->>'outcome_asset_id')::uuid,asset_revision=(select revision from marketing.assets where id=(r->>'outcome_asset_id')::uuid),revision=revision+1,updated_at=now(),last_actor_user_id=null where id=o.id;
  update marketing.task_orchestrations set constraint_preflight=coalesce((select jsonb_agg(q) from jsonb_array_elements(r->'output_metadata'->'deterministic_qa') q where q ? 'constraint_id'),'[]'::jsonb) where id=o.id returning * into o;
  if exists(select 1 from jsonb_array_elements(o.constraint_preflight) q where q->>'passed'='false') then
   update marketing.task_orchestrations set state=case when revision_cycles>=3 then 'blocked' else 'changes_needed' end,
    reason='Human constraint failed',completed_at=case when revision_cycles>=3 then now() else null end,revision=revision+1,updated_at=now() where id=o.id returning * into o;
   return jsonb_build_object('orchestration',to_jsonb(o));
  end if;
  update marketing.task_orchestrations set reason=null where id=o.id;
  return marketing.start_orchestration_stage(o.id,'guardian',(r->>'initiated_by')::uuid);
 else
  update marketing.task_orchestrations set state=case when r->'output_metadata'->'result'->>'recommendation'='ready_for_human_review' then 'awaiting_review' when revision_cycles>=3 then 'blocked' else 'changes_needed' end,
   reason=case when r->'output_metadata'->'result'->>'recommendation'='needs_changes' and revision_cycles>=3 then 'Three revision cycles exhausted; review manually' else null end,
   completed_at=case when r->'output_metadata'->'result'->>'recommendation'='needs_changes' and revision_cycles>=3 then now() else null end,
   revision=revision+1,updated_at=now(),last_actor_user_id=null where id=o.id returning * into o;
 end if;
 return jsonb_build_object('orchestration',to_jsonb(o));
end $$;
create or replace function public.read_marketing_attention_workspace(p_workspace uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; w uuid;
begin
 result:=public.read_marketing_workspace(p_workspace);
 w:=(result->'workspace'->>'id')::uuid;
 return result || jsonb_build_object(
  'human_constraint_sets',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('superseded',exists(select 1 from marketing.human_constraint_sets n where n.supersedes_id=s.id))) from marketing.human_constraint_sets s where workspace_id=w),'[]'::jsonb),
  'asset_constraint_checks',coalesce((select jsonb_agg(jsonb_build_object('asset_id',a.id,'revision',a.revision,'checks',marketing.evaluate_human_constraints(a.content,marketing.applicable_constraint_sets(w,a.id)))) from marketing.assets a where a.workspace_id=w),'[]'::jsonb),
  'orchestrations',coalesce((select jsonb_agg(to_jsonb(o)) from marketing.task_orchestrations o where workspace_id=w),'[]'::jsonb),
  'orchestration_history',coalesce((select jsonb_agg(to_jsonb(h) order by h.id) from marketing.orchestration_history h where workspace_id=w),'[]'::jsonb),
  'resolutions',coalesce((select jsonb_agg(to_jsonb(h)) from marketing.agent_run_resolutions h where h.workspace_id=w),'[]'::jsonb),
  'attention_runs',coalesce((select jsonb_agg(jsonb_build_object(
   'id',r.id,'campaign_id',r.campaign_id,'workspace_id',r.workspace_id,'agent_key',r.agent_key,'purpose',r.purpose,'status',r.status,
   'started_at',r.started_at,'ended_at',r.ended_at,'outcome_asset_id',r.outcome_asset_id,
   'asset_id',r.input_metadata->'asset'->>'id','asset_revision',r.input_metadata->'asset'->'revision',
   'recommendation',r.output_metadata->'result'->>'recommendation',
   'has_findings',coalesce(jsonb_array_length(r.output_metadata->'result'->'findings'),0)>0,
   'qa_failed',exists(select 1 from jsonb_array_elements(coalesce(r.output_metadata->'deterministic_qa','[]')) q where q->>'passed'='false')
  )) from marketing.agent_runs r where r.workspace_id=w),'[]'::jsonb),
  'attention_events',coalesce((select jsonb_agg(jsonb_build_object('asset_id',h.asset_id,'revision',h.snapshot->'revision','action',h.action,'occurred_at',h.occurred_at))
    from (select distinct on (asset_id) asset_id,snapshot,action,occurred_at from marketing.workflow_history
     where workspace_id=w and asset_id is not null and (action='asset_saved' or (actor_type='human' and action in ('approved','changes_requested')))
     order by asset_id,(snapshot->>'revision')::integer desc,id desc) h),'[]'::jsonb));
end $$;



revoke all on function marketing.applicable_constraint_sets(uuid,uuid,uuid),marketing.normalize_constraint_text(text),marketing.evaluate_human_constraints(text,jsonb),
 marketing.write_asset_internal(uuid,uuid,uuid,integer,text,jsonb,text,uuid),marketing.write_asset_internal_before_constraints(uuid,uuid,uuid,integer,text,jsonb,text,uuid),
 marketing.attach_human_constraints(),marketing.start_marketing_agent_run_before_constraints(uuid,uuid,jsonb,text,text),marketing.finish_marketing_agent_run_before_constraints(uuid,jsonb,jsonb,jsonb,text),
 public.start_marketing_agent_run(uuid,uuid,jsonb,text,text),public.finish_marketing_agent_run(uuid,jsonb,jsonb,jsonb,text),public.save_marketing_human_constraints(uuid,uuid,integer,uuid,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function public.start_marketing_agent_run(uuid,uuid,jsonb,text,text),public.finish_marketing_agent_run(uuid,jsonb,jsonb,jsonb,text) to service_role;
grant execute on function public.save_marketing_human_constraints(uuid,uuid,integer,uuid,jsonb) to authenticated;
commit;
