begin;
create table marketing.policy_versions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references marketing.workspaces(id),
 campaign_id uuid, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 supersedes_id uuid unique references marketing.policy_versions(id), constraints jsonb not null check(jsonb_typeof(constraints)='array'),
 foreign key(workspace_id,campaign_id) references marketing.campaigns(workspace_id,id)
);
create unique index workspace_policy_root on marketing.policy_versions(workspace_id) where campaign_id is null and supersedes_id is null;
create unique index campaign_policy_root on marketing.policy_versions(workspace_id,campaign_id) where campaign_id is not null and supersedes_id is null;
create index policy_workspace on marketing.policy_versions(workspace_id,campaign_id);
alter table marketing.policy_versions enable row level security;
revoke all on marketing.policy_versions from public,anon,authenticated,service_role;
create trigger immutable_marketing_policy before update or delete on marketing.policy_versions for each row execute function marketing.prevent_audit_mutation();
create function marketing.validate_policy_rules(p_constraints jsonb,p_prior jsonb default '[]') returns jsonb
language plpgsql set search_path='' as $$
declare item jsonb; entries jsonb:='[]'; cid uuid;
begin
 if jsonb_typeof(p_constraints) is distinct from 'array' or jsonb_array_length(p_constraints)>30 then raise exception 'Invalid constraints'; end if;
 for item in select value from jsonb_array_elements(p_constraints) loop
  if jsonb_typeof(item) is distinct from 'object' or exists(select 1 from jsonb_object_keys(item) k where k not in ('constraint_type','value','rationale','details'))
   or coalesce(item->>'constraint_type','') not in ('prohibited_phrase','prohibited_claim','required_phrase_or_concept','required_destination','no_fabricated_testimonial','no_unverified_comparative_claim','no_unverified_outcome_claim','human_instruction','approved_destination')
   or (item ? 'rationale' and (jsonb_typeof(item->'rationale') is distinct from 'string' or length(item->>'rationale')>1000)) then raise exception 'Invalid constraint'; end if;
  if item->>'constraint_type' in ('prohibited_phrase','prohibited_claim','required_phrase_or_concept','required_destination','human_instruction','approved_destination') then
   if jsonb_typeof(item->'value') is distinct from 'string' or length(marketing.normalize_constraint_text(item->>'value')) not between 1 and 240 then raise exception 'Constraint value required'; end if;
  elsif coalesce(item->>'value','')<>'' then raise exception 'Toggle cannot contain a value'; end if;
  if item->>'constraint_type' in ('required_destination','approved_destination') and lower(item->>'value') !~ '^(www\.)?[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$' then raise exception 'Destination must be a hostname'; end if;
  if item ? 'details' and (item->>'constraint_type'<>'required_phrase_or_concept' or jsonb_typeof(item->'details') is distinct from 'object'
   or exists(select 1 from jsonb_object_keys(item->'details') k where k<>'mode') or coalesce(item->'details'->>'mode','') not in ('phrase','concept')) then raise exception 'Invalid constraint details'; end if;
  select (v->>'id')::uuid into cid from jsonb_array_elements(coalesce(p_prior,'[]')) v where v-'id'=item limit 1;
  entries:=entries||jsonb_build_array(item||jsonb_build_object('id',coalesce(cid,gen_random_uuid())));
 end loop;
 if (select count(distinct v-'id') from jsonb_array_elements(entries) v)<>jsonb_array_length(entries) then raise exception 'Duplicate constraints'; end if;
 return entries;
end $$;

create function public.save_marketing_policy(p_workspace uuid,p_campaign uuid,p_expected_set uuid,p_rules jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior marketing.policy_versions; saved marketing.policy_versions; rules jsonb;
begin
 if not marketing.has_membership(p_workspace,array['approver','admin']) then raise exception 'Policy management permission required' using errcode='42501'; end if;
 perform 1 from marketing.workspaces where id=p_workspace for update;
 if p_campaign is not null and not exists(select 1 from marketing.campaigns where workspace_id=p_workspace and id=p_campaign) then raise exception 'Campaign unavailable' using errcode='42501'; end if;
 select * into prior from marketing.policy_versions s where workspace_id=p_workspace and campaign_id is not distinct from p_campaign
  and not exists(select 1 from marketing.policy_versions n where n.supersedes_id=s.id);
 if prior.id is distinct from p_expected_set then raise exception 'Policy changed; refresh required' using errcode='40001'; end if;
 rules:=marketing.validate_policy_rules(p_rules,coalesce(prior.constraints,'[]'));
 insert into marketing.policy_versions(workspace_id,campaign_id,created_by,supersedes_id,constraints) values(p_workspace,p_campaign,auth.uid(),prior.id,rules) returning * into saved;
 return to_jsonb(saved);
end $$;
create function marketing.effective_constraint_sets(p_workspace uuid,p_campaign uuid,p_asset uuid default null,p_orchestration uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(s order by s->>'id'),'[]') from (
  select to_jsonb(p)||jsonb_build_object('source_scope',case when p.campaign_id is null then 'Workspace' else 'Campaign' end) s
   from marketing.policy_versions p where p.workspace_id=p_workspace and (p.campaign_id is null or p.campaign_id=p_campaign)
   and not exists(select 1 from marketing.policy_versions n where n.supersedes_id=p.id)
  union all
  select to_jsonb(h)||jsonb_build_object('source_scope','Human review') from marketing.human_constraint_sets h where h.workspace_id=p_workspace
   and h.campaign_id=p_campaign and (h.asset_id=p_asset or h.orchestration_id=p_orchestration)
   and not exists(select 1 from marketing.human_constraint_sets n where n.supersedes_id=h.id)
 ) combined
$$;
create or replace function marketing.applicable_constraint_sets(p_workspace uuid,p_asset uuid,p_orchestration uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select marketing.effective_constraint_sets(p_workspace,coalesce((select campaign_id from marketing.assets where id=p_asset and workspace_id=p_workspace),
  (select campaign_id from marketing.task_orchestrations where id=p_orchestration and workspace_id=p_workspace)),p_asset,p_orchestration)
$$;
alter function marketing.evaluate_human_constraints(text,jsonb) rename to evaluate_human_constraints_before_policy;
create function marketing.evaluate_human_constraints(p_content text,p_sets jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare s jsonb; c jsonb; q jsonb; result jsonb:='[]'; tokens text[]; destination text; matched text;
begin
 for s in select value from jsonb_array_elements(p_sets) loop
  for c in select value from jsonb_array_elements(s->'constraints') loop
   if c->>'constraint_type'='human_instruction' then
    q:=jsonb_build_object('rule','human_constraint:'||(c->>'id'),'constraint_id',c->>'id','constraint_type','human_instruction','passed',true,'review_required',true,'detail',c->>'value','qa_version','human-policy-v1');
   elsif c->>'constraint_type'='approved_destination' then
    matched:=null;
    for tokens in select regexp_matches(lower(coalesce(p_content,'')),'(?:https?://|www\.)[^\s<>()[\]"'']+|\m[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}(?:/[^\s<>()[\]"'']*)?','g') loop
     destination:=regexp_replace(tokens[1],'[.,;:!?]+$',''); destination:=regexp_replace(destination,'^https?://',''); destination:=regexp_replace(destination,'^www\.',''); destination:=regexp_replace(destination,'/$','');
     if destination<>regexp_replace(lower(c->>'value'),'^www\.','') then matched:=tokens[1]; exit; end if;
    end loop;
    q:=jsonb_build_object('rule','human_constraint:'||(c->>'id'),'constraint_id',c->>'id','constraint_type','approved_destination','passed',matched is null,'review_required',false,'detail','Only approved destination: '||(c->>'value'),'matched_text',matched,'qa_version','human-policy-v1');
   else q:=marketing.evaluate_human_constraints_before_policy(p_content,jsonb_build_array(jsonb_build_object('constraints',jsonb_build_array(c))))->0; end if;
   result:=result||jsonb_build_array(q||jsonb_build_object('source_scope',coalesce(s->>'source_scope','Human review'),'source_set_id',s->'id','source_created_by',s->'created_by'));
  end loop;
 end loop;
 return result;
end $$;
create or replace function marketing.attach_human_constraints() returns trigger language plpgsql security definer set search_path='' as $$
declare sets jsonb; aid uuid; oid uuid;
begin
 aid:=(new.input_metadata->'asset'->>'id')::uuid; oid:=(new.input_metadata->'orchestration'->>'id')::uuid;
 perform 1 from marketing.workspaces where id=new.workspace_id for share;
 sets:=marketing.effective_constraint_sets(new.workspace_id,new.campaign_id,aid,oid);
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
create or replace function marketing.finish_marketing_agent_run_before_recovery(p_id uuid,p_output jsonb,p_qa jsonb,p_usage jsonb,p_error text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r marketing.agent_runs; sets jsonb; checks jsonb:='[]'; evaluations jsonb; failure text:=p_error;
begin
 select * into r from marketing.agent_runs where id=p_id for update;
 if not found then raise exception 'Agent run unavailable'; end if;
 if r.status<>'started' then return to_jsonb(r); end if;
 perform 1 from marketing.assets where id=(r.input_metadata->'asset'->>'id')::uuid for share;
 perform 1 from marketing.workspaces where id=r.workspace_id for share;
 sets:=marketing.effective_constraint_sets(r.workspace_id,r.campaign_id,(r.input_metadata->'asset'->>'id')::uuid,(r.input_metadata->'orchestration'->>'id')::uuid);
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
create or replace function public.save_marketing_human_constraints(p_workspace uuid,p_asset uuid,p_expected_revision integer,p_expected_set uuid,p_constraints jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a marketing.assets; prior marketing.human_constraint_sets; saved marketing.human_constraint_sets; item jsonb; entries jsonb:='[]'; cid uuid; oid uuid;
begin
 if not marketing.has_membership(p_workspace,array['contributor','approver','admin']) then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 select * into a from marketing.assets where workspace_id=p_workspace and id=p_asset for update;
 if not found or a.revision is distinct from p_expected_revision or a.publication_state<>'unpublished' or a.approval_state not in ('draft','changes_requested') then raise exception 'Asset changed or not editable'; end if;
 select * into prior from marketing.human_constraint_sets s where s.asset_id=a.id and not exists(select 1 from marketing.human_constraint_sets n where n.supersedes_id=s.id);
 if prior.id is distinct from p_expected_set then raise exception 'Constraints changed; refresh'; end if;
 entries:=marketing.validate_policy_rules(p_constraints,coalesce(prior.constraints,'[]'));
 select id into oid from marketing.task_orchestrations where workspace_id=p_workspace and asset_id=a.id order by started_at desc limit 1;
 insert into marketing.human_constraint_sets(workspace_id,campaign_id,asset_id,orchestration_id,created_by,source_revision,source_decision_id,supersedes_id,constraints)
 values(p_workspace,a.campaign_id,a.id,oid,auth.uid(),a.revision,
  (select id from marketing.workflow_history where asset_id=a.id and actor_type='human' and action='changes_requested' and (snapshot->>'revision')::integer=a.revision order by id desc limit 1),prior.id,entries) returning * into saved;
 return to_jsonb(saved);
end $$;

create or replace function marketing.write_asset_internal_before_constraints(p_workspace uuid,p_campaign uuid,p_id uuid,p_expected_revision integer,
 p_action text,p_payload jsonb,p_actor_type text,p_agent_run uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare old marketing.assets; saved marketing.assets; next_state text;
begin
 perform marketing.check_workflow_write(p_workspace,p_campaign,p_payload,
  case when p_action='save' then array['name','asset_type','content'] else array['notes'] end);
 -- Serialize review snapshots with campaign edits so context is attributable too.
 perform 1 from marketing.campaigns where workspace_id=p_workspace and id=p_campaign for share;
 if p_id is null or p_action is null or p_action not in ('save','submit','approve','request_changes') then raise exception 'Invalid asset action'; end if;
 if p_actor_type is null or p_actor_type not in ('human','agent') then raise exception 'Invalid actor type'; end if;
 if p_actor_type='human' and p_agent_run is not null then raise exception 'Human changes cannot claim an agent run'; end if;
 if p_actor_type='agent' then
  if p_action in ('approve','request_changes') then raise exception 'Agents cannot make human review decisions'; end if;
  if p_agent_run is null or not exists(select 1 from marketing.agent_runs where id=p_agent_run and workspace_id=p_workspace
    and (campaign_id is null or campaign_id=p_campaign) and initiated_by=auth.uid()) then raise exception 'Agent run unavailable'; end if;
 end if;
 if p_action in ('approve','request_changes') and not marketing.has_membership(p_workspace,array['approver','admin']) then
  raise exception 'Human approver role required' using errcode='42501';
 end if;
 select * into old from marketing.assets where workspace_id=p_workspace and campaign_id=p_campaign and id=p_id for update;
 if found then
  if p_expected_revision is null or old.revision<>p_expected_revision then raise exception 'Asset changed; refresh before retrying'; end if;
  if old.publication_state<>'unpublished' then raise exception 'Published or retired assets cannot be revised here'; end if;
 else
  if p_expected_revision is not null or p_action<>'save' then raise exception 'Asset unavailable'; end if;
 end if;
 if p_action='save' then
  if length(trim(coalesce(p_payload->>'name',''))) not between 1 and 160 then raise exception 'Asset name required (maximum 160 characters)'; end if;
  if p_payload->>'asset_type' is null or p_payload->>'asset_type' not in ('social_copy','email_copy','web_copy','print_copy','image_brief','video_brief') then raise exception 'Invalid asset type'; end if;
  if old.approval_state='in_review' then raise exception 'Request changes before editing an asset in review'; end if;
  if old.id is null then
   insert into marketing.assets(id,workspace_id,campaign_id,name,asset_type,content,created_by,created_via,updated_by)
   values(p_id,p_workspace,p_campaign,trim(p_payload->>'name'),p_payload->>'asset_type',coalesce(p_payload->>'content',''),auth.uid(),p_actor_type,auth.uid()) returning * into saved;
  else
   update marketing.assets set name=trim(p_payload->>'name'),asset_type=p_payload->>'asset_type',content=coalesce(p_payload->>'content',''),
    approval_state='draft',approved_by=null,approved_at=null,updated_by=auth.uid(),updated_at=now(),revision=revision+1 where id=p_id returning * into saved;
  end if;
 else
  if p_action='submit' then
   if old.approval_state not in ('draft','changes_requested') then raise exception 'Only drafts or requested changes can be submitted'; end if;
   if length(trim(old.content))=0 then raise exception 'Asset content required before review'; end if;
   next_state:='in_review';
  else
   if old.approval_state<>'in_review' and not(p_action='request_changes' and p_actor_type='human' and old.approval_state in ('draft','changes_requested')
    and exists(select 1 from marketing.task_orchestrations where workspace_id=p_workspace and campaign_id=p_campaign and asset_id=p_id and state in ('awaiting_review','changes_needed','failed','blocked'))) then raise exception 'Asset must be in review'; end if;
   if p_action='request_changes' and length(trim(coalesce(p_payload->>'notes','')))=0 then raise exception 'Describe the requested changes'; end if;
   next_state:=case when p_action='approve' then 'approved' else 'changes_requested' end;
  end if;
  update marketing.assets set approval_state=next_state,
   approved_by=case when next_state='approved' then auth.uid() end,approved_at=case when next_state='approved' then now() end,
   updated_by=auth.uid(),updated_at=now(),revision=revision+1 where id=p_id returning * into saved;
 end if;
 insert into marketing.workflow_history(workspace_id,campaign_id,asset_id,action,actor_type,actor_user_id,agent_run_id,notes,snapshot)
 values(p_workspace,p_campaign,p_id,case p_action when 'save' then 'asset_saved' when 'submit' then 'submitted' when 'approve' then 'approved' else 'changes_requested' end,
  p_actor_type,auth.uid(),p_agent_run,coalesce(p_payload->>'notes',''),to_jsonb(saved) || jsonb_build_object(
   'campaign_context',(select to_jsonb(c) from marketing.campaigns c where c.id=p_campaign),
   'success_metrics',coalesce((select jsonb_agg(to_jsonb(k)) from marketing.campaign_kpis k where k.workspace_id=p_workspace and k.campaign_id=p_campaign),'[]'::jsonb)));
 return p_id;
end $$;


-- Availability and command validation share the same authoritative evidence.
create function marketing.guided_work_context(p_id uuid,p_human uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o marketing.task_orchestrations; a marketing.assets; t marketing.campaign_tasks; g marketing.agent_runs; ctx jsonb; actions jsonb:='[]'; role_name text; current_context boolean; policy_current boolean; reason text;
begin
 select * into o from marketing.task_orchestrations where id=p_id;
 select role into role_name from marketing.workspace_members where workspace_id=o.workspace_id and user_id=p_human;
 if role_name is null then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 select * into a from marketing.assets where id=o.asset_id;
 select * into t from marketing.campaign_tasks where id=o.task_id;
 select * into g from marketing.agent_runs where id=o.active_run_id;
 ctx:=marketing.orchestration_revision_context(o.id,p_human);
 current_context:=t.revision=o.task_revision and t.status in ('todo','in_progress') and exists(select 1 from marketing.campaigns where id=o.campaign_id and revision=o.campaign_revision);
 policy_current:=coalesce(g.input_metadata->'human_constraint_sets','[]')=marketing.effective_constraint_sets(o.workspace_id,o.campaign_id,a.id,o.id);
 reason:=ctx->>'reason';
 if role_name in ('contributor','approver','admin') then
  if o.state='completed' and t.status<>'done' and t.revision=o.task_revision then actions:='["complete_task"]';
  elsif o.state='awaiting_plan' and current_context and policy_current then actions:='["accept","stop"]';
  elsif o.state in ('awaiting_review','awaiting_approval') and current_context and a.revision=o.asset_revision and a.publication_state='unpublished'
   and g.status='succeeded' and g.agent_key='guardian' and g.input_metadata->'orchestration'->>'id'=o.id::text then
   if role_name in ('approver','admin') then
    if policy_current and g.output_metadata->'result'->>'recommendation'='ready_for_human_review' and not exists(select 1 from jsonb_array_elements(marketing.evaluate_human_constraints(a.content,marketing.effective_constraint_sets(o.workspace_id,o.campaign_id,a.id,o.id))) q where q->>'passed'='false') then actions:=actions||'"approve"'::jsonb; end if;
    if o.revision_cycles<3 then actions:=actions||'"request_changes"'::jsonb; end if;
   end if;
   reason:=case when not policy_current then 'Marketing Policy changed since this assessment. Request a revision using the current policy.' else 'Review this draft and decide whether it meets your requirements.' end;
  elsif (ctx->>'eligible')::boolean then
   actions:='["revise"]';
   if role_name in ('approver','admin') then actions:=actions||'"request_changes"'::jsonb; end if;
  elsif ctx->>'reason' in ('Record human requested changes on the current asset before recovery','Current human requested-change evidence is required') and role_name in ('approver','admin') then actions:='["request_changes"]';
  end if;
 end if;
 if o.state='awaiting_plan' then reason:='Review the proposed plan before authorizing more work.';
 elsif o.state='creator_running' then reason:='Creator is writing your content.';
 elsif o.state='guardian_running' then reason:='The policy preflight passed. Guardian is reviewing the draft.';
 elsif o.state='strategist_running' then reason:='Strategist is preparing your execution plan.';
 elsif o.state in ('failed','blocked') and actions ? 'request_changes' then reason:='You can continue this work. Tell Creator what needs to change; the same task will resume with a new revision.';
 elsif o.state in ('awaiting_review','awaiting_approval') and role_name not in ('approver','admin') then reason:='A workspace approver or administrator must decide whether to approve this content or request changes.';
 end if;
 return ctx||jsonb_build_object('actions',actions,'reason',reason,'expected_revision',o.revision);
end $$;

alter function public.command_marketing_orchestration(uuid,jsonb) rename to command_marketing_orchestration_before_guided;
alter function public.command_marketing_orchestration_before_guided(uuid,jsonb) set schema marketing;
create function public.command_marketing_orchestration(p_human uuid,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o marketing.task_orchestrations; a marketing.assets; ctx jsonb; supplied jsonb; prior marketing.human_constraint_sets; existing_rules jsonb; result jsonb; w uuid:=(p_request->>'workspace_id')::uuid; decision text:=p_request->>'decision';
begin
 if p_request->>'action' is distinct from 'review' then return marketing.command_marketing_orchestration_before_guided(p_human,p_request); end if;
 perform 1 from marketing.workspace_members where workspace_id=w and user_id=p_human and role in ('approver','admin') for share;
 if not found then raise exception 'Human review permission required' using errcode='42501'; end if;
 if exists(select 1 from jsonb_object_keys(p_request) k where k not in ('workspace_id','id','action','expected_revision','asset_revision','task_revision','campaign_revision','constraint_set_ids','decision','notes','review_constraints'))
  or decision is null or decision not in ('approve','request_changes') or jsonb_typeof(p_request->'constraint_set_ids') is distinct from 'array'
  or length(coalesce(p_request->>'notes',''))>4000 or (decision='request_changes' and length(trim(coalesce(p_request->>'notes','')))=0) then raise exception 'Invalid guided review'; end if;
 select * into o from marketing.task_orchestrations where id=(p_request->>'id')::uuid and workspace_id=w for update;
 if not found then raise exception 'Orchestration unavailable' using errcode='42501'; end if;
 if (p_request->>'expected_revision')::integer is distinct from o.revision then return jsonb_build_object('orchestration',to_jsonb(o)); end if;
 perform 1 from marketing.campaign_tasks where id=o.task_id for update;
 perform 1 from marketing.campaigns where id=o.campaign_id for share;
 select * into a from marketing.assets where id=o.asset_id for update;
 perform 1 from marketing.workspaces where id=w for share;
 ctx:=marketing.guided_work_context(o.id,p_human);
 if not(ctx->'actions' ? decision) then raise exception 'Review unavailable: %',ctx->>'reason' using errcode='40001'; end if;
 select coalesce(jsonb_agg(to_jsonb(value::uuid::text) order by value::uuid::text),'[]') into supplied from jsonb_array_elements_text(p_request->'constraint_set_ids');
 if (p_request->>'asset_revision')::integer is distinct from a.revision or (p_request->>'task_revision')::integer is distinct from o.task_revision
  or (p_request->>'campaign_revision')::integer is distinct from o.campaign_revision or supplied is distinct from ctx->'constraint_set_ids' then raise exception 'Review context changed; refresh required' using errcode='40001'; end if;
 perform set_config('request.jwt.claim.sub',p_human::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_human)::text,true);
 if decision='approve' then
  if o.state='awaiting_review' then
   result:=marketing.command_marketing_orchestration_before_guided(p_human,jsonb_build_object('workspace_id',w,'id',o.id,'action','submit','expected_revision',o.revision,'instructions',coalesce(p_request->>'notes','')));
  end if;
  select * into a from marketing.assets where id=o.asset_id;
  perform public.write_marketing_asset(w,o.campaign_id,a.id,a.revision,'approve',jsonb_build_object('notes',coalesce(p_request->>'notes','')));
  select * into o from marketing.task_orchestrations where id=o.id;
  if o.state<>'completed' then raise exception 'Approval did not advance workflow'; end if;
  return jsonb_build_object('orchestration',to_jsonb(o));
 end if;
 perform public.write_marketing_asset(w,o.campaign_id,a.id,a.revision,'request_changes',jsonb_build_object('notes',p_request->>'notes'));
 select * into a from marketing.assets where id=o.asset_id;
 select * into prior from marketing.human_constraint_sets s where asset_id=a.id and not exists(select 1 from marketing.human_constraint_sets n where n.supersedes_id=s.id);
 select coalesce(jsonb_agg(v-'id'),'[]') into existing_rules from jsonb_array_elements(coalesce(prior.constraints,'[]')) v;
 if p_request ? 'review_constraints' and p_request->'review_constraints' is distinct from existing_rules then
  perform public.save_marketing_human_constraints(w,a.id,a.revision,prior.id,p_request->'review_constraints');
 end if;
 -- Draft feedback has no submission event; record the human gate transition explicitly.
 update marketing.task_orchestrations set state='changes_needed',asset_revision=a.revision,revision=revision+1,updated_at=now(),last_actor_user_id=p_human,reason='Human requested changes'
  where id=o.id and state='awaiting_review';
 select * into o from marketing.task_orchestrations where id=o.id;
 ctx:=marketing.orchestration_revision_context(o.id,p_human);
 -- Any failure rolls back feedback, constraints and authorization together.
 return marketing.command_marketing_orchestration_before_guided(p_human,jsonb_build_object('workspace_id',w,'id',o.id,'action','revise','expected_revision',o.revision,
  'asset_revision',a.revision,'task_revision',ctx->'task_revision','campaign_revision',ctx->'campaign_revision','constraint_set_ids',ctx->'constraint_set_ids','instructions','Implement the current human requested changes and effective Marketing Policy.'));
end $$;

alter function public.read_marketing_attention_workspace(uuid) rename to read_marketing_attention_workspace_before_policy;
alter function public.read_marketing_attention_workspace_before_policy(uuid) set schema marketing;
create function public.read_marketing_attention_workspace(p_workspace uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; w uuid;
begin
 result:=marketing.read_marketing_attention_workspace_before_policy(p_workspace); w:=(result->'workspace'->>'id')::uuid;
 return result||jsonb_build_object('policy_versions',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('superseded',exists(select 1 from marketing.policy_versions n where n.supersedes_id=p.id)) order by p.created_at) from marketing.policy_versions p where workspace_id=w),'[]'),
 'guided_work',coalesce((select jsonb_agg(marketing.guided_work_context(o.id,auth.uid())) from marketing.task_orchestrations o where workspace_id=w),'[]'));
end $$;
revoke all on function marketing.validate_policy_rules(jsonb,jsonb),marketing.effective_constraint_sets(uuid,uuid,uuid,uuid),marketing.evaluate_human_constraints_before_policy(text,jsonb),marketing.evaluate_human_constraints(text,jsonb),marketing.guided_work_context(uuid,uuid),marketing.command_marketing_orchestration_before_guided(uuid,jsonb),marketing.read_marketing_attention_workspace_before_policy(uuid),public.command_marketing_orchestration(uuid,jsonb),public.read_marketing_attention_workspace(uuid),public.save_marketing_policy(uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.command_marketing_orchestration(uuid,jsonb) to service_role;
grant execute on function public.save_marketing_policy(uuid,uuid,uuid,jsonb),public.read_marketing_attention_workspace(uuid) to authenticated;
create or replace function marketing.start_orchestration_stage(p_id uuid,p_agent text,p_human uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o marketing.task_orchestrations; request jsonb; context jsonb; run_id uuid:=gen_random_uuid();
begin
 update marketing.task_orchestrations set active_run_id=run_id,run_ids=array_append(run_ids,run_id),state=p_agent||'_running',
  revision=revision+1,updated_at=now(),last_actor_user_id=null where id=p_id returning * into o;
 request:=jsonb_build_object('workspace_id',o.workspace_id,'campaign_id',o.campaign_id,'agent_key',p_agent,
  'purpose','Work on assigned campaign task: '||(select title from marketing.campaign_tasks where id=o.task_id));
 if p_agent='creator' then
  if o.asset_id is null then request:=request||jsonb_build_object('asset_type',o.asset_type,'submit_for_review',false);
  else request:=request||jsonb_build_object('revision_asset_id',o.asset_id,'expected_asset_revision',o.asset_revision,
   'expected_campaign_revision',o.campaign_revision,'supplemental_instructions',o.instructions,'submit_for_review',false); end if;
 elsif p_agent='guardian' then request:=request||jsonb_build_object('asset_id',o.asset_id); end if;
 context:=public.start_marketing_agent_run(run_id,p_human,request,'marketing-policy-v1','gpt-4.1-mini');
 return jsonb_build_object('orchestration',to_jsonb(o),'run',jsonb_build_object('id',run_id,'context',context));
end $$;
-- Keep historical instruction versions readable while registering the new server contract.
do $migration$
declare signature text; definition text;
begin
 foreach signature in array array['marketing.start_marketing_agent_run_before_constraints(uuid,uuid,jsonb,text,text)','marketing.finish_marketing_agent_run_before_constraints(uuid,jsonb,jsonb,jsonb,text)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if position('''marketing-v1'',''marketing-v2''' in definition)=0 then raise exception 'Expected instruction-version guard missing'; end if;
  execute replace(definition,'''marketing-v1'',''marketing-v2''','''marketing-v1'',''marketing-v2'',''marketing-policy-v1''');
 end loop;
end $migration$;
commit;
