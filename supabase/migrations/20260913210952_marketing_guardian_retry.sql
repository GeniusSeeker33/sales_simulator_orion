begin;
-- Install the canonical lower-layer contract explicitly. Hosted compatibility restores
-- may retain the older whitelist that rejected required constraint_evaluations.
create or replace function marketing.finish_marketing_agent_run_before_constraints(p_id uuid,p_output jsonb,p_qa jsonb,p_usage jsonb,p_error text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r marketing.agent_runs; c marketing.campaigns; a marketing.assets; asset_id uuid; failure text:=p_error; previous_sub text; previous_claims text;
begin
 select * into r from marketing.agent_runs where id=p_id for update;
 if not found then raise exception 'Agent run unavailable'; end if;
 if r.status<>'started' then return to_jsonb(r); end if;
 if r.instruction_version is null or r.instruction_version not in ('marketing-v1','marketing-v2','marketing-policy-v1') then raise exception 'Unsupported agent run'; end if;
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
revoke all on function marketing.finish_marketing_agent_run_before_constraints(uuid,jsonb,jsonb,jsonb,text) from public,anon,authenticated,service_role;
create table marketing.guardian_retry_authorizations (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references marketing.workspaces(id),
 orchestration_id uuid not null references marketing.task_orchestrations(id), actor_user_id uuid not null references auth.users(id),
 from_revision integer not null, prior_run_id uuid not null unique references marketing.agent_runs(id),
 new_run_id uuid not null unique references marketing.agent_runs(id) deferrable initially deferred,
 asset_revision integer not null, policy_snapshot jsonb not null, occurred_at timestamptz not null default now(), unique(orchestration_id,from_revision)
);
create table marketing.agent_run_diagnostics (
 agent_run_id uuid primary key references marketing.agent_runs(id), workspace_id uuid not null references marketing.workspaces(id),
 reason text not null check(reason in ('guardian_output_schema_invalid','constraint_evaluation_mismatch','effective_policy_changed','asset_revision_changed','campaign_revision_changed','task_revision_changed','permission_revoked','run_expired','guardian_persistence_failed','guardian_model_failed','guardian_result_rejected')),
 occurred_at timestamptz not null default now()
);
alter table marketing.guardian_retry_authorizations enable row level security;
alter table marketing.agent_run_diagnostics enable row level security;
revoke all on marketing.guardian_retry_authorizations,marketing.agent_run_diagnostics from public,anon,authenticated,service_role;
create trigger immutable_guardian_retries before update or delete on marketing.guardian_retry_authorizations for each row execute function marketing.prevent_audit_mutation();
create trigger immutable_run_diagnostics before update or delete on marketing.agent_run_diagnostics for each row execute function marketing.prevent_audit_mutation();
create index guardian_retries_workspace on marketing.guardian_retry_authorizations(workspace_id,orchestration_id);
create index run_diagnostics_workspace on marketing.agent_run_diagnostics(workspace_id);

create function marketing.guardian_failure_reason(p_id uuid,p_output jsonb,p_error text) returns text
language plpgsql stable security definer set search_path='' as $$
declare r marketing.agent_runs; evaluations jsonb; sets jsonb;
begin
 select * into r from marketing.agent_runs where id=p_id;
 if not exists(select 1 from marketing.workspace_members where workspace_id=r.workspace_id and user_id=r.initiated_by and role in ('contributor','approver','admin')) then return 'permission_revoked'; end if;
 if not exists(select 1 from marketing.campaigns where id=r.campaign_id and revision=(r.input_metadata->'campaign'->>'revision')::integer) then return 'campaign_revision_changed'; end if;
 if r.input_metadata ? 'task' and not exists(select 1 from marketing.campaign_tasks where id=(r.input_metadata->'task'->>'id')::uuid and revision=(r.input_metadata->'task'->>'revision')::integer) then return 'task_revision_changed'; end if;
 if not exists(select 1 from marketing.assets where id=(r.input_metadata->'asset'->>'id')::uuid and revision=(r.input_metadata->'asset'->>'revision')::integer) then return 'asset_revision_changed'; end if;
 sets:=marketing.effective_constraint_sets(r.workspace_id,r.campaign_id,(r.input_metadata->'asset'->>'id')::uuid,(r.input_metadata->'orchestration'->>'id')::uuid);
 if sets is distinct from coalesce(r.input_metadata->'human_constraint_sets','[]') then return 'effective_policy_changed'; end if;
 if r.started_at<now()-interval '2 minutes' then return 'run_expired'; end if;
 if p_error='constraint_evaluation_mismatch' then return p_error;
 elsif p_error in ('invalid_output','guardian_output_schema_invalid') then return 'guardian_output_schema_invalid';
 elsif p_error='model_failed' then return 'guardian_model_failed';
 elsif p_error='persistence_failed' then return 'guardian_persistence_failed'; end if;
 if p_output is null or jsonb_typeof(p_output)<>'object' then return 'guardian_output_schema_invalid'; end if;
 if exists(select 1 from jsonb_object_keys(p_output) k where k not in ('summary','recommendation','findings','constraint_evaluations')) then return 'guardian_output_schema_invalid'; end if;
 evaluations:=p_output->'constraint_evaluations';
 if jsonb_typeof(evaluations) is distinct from 'array' then return 'constraint_evaluation_mismatch'; end if;
 if jsonb_array_length(evaluations)<>(select count(*) from jsonb_array_elements(sets) s cross join lateral jsonb_array_elements(s->'constraints') c)
  or (select count(distinct e->>'constraint_id') from jsonb_array_elements(evaluations) e)<>jsonb_array_length(evaluations)
  or exists(select 1 from jsonb_array_elements(evaluations) e where e->>'status' not in ('satisfied','violated','semantic_review') or not exists(select 1 from jsonb_array_elements(sets) s cross join lateral jsonb_array_elements(s->'constraints') c where c->>'id'=e->>'constraint_id')) then return 'constraint_evaluation_mismatch'; end if;
 return 'guardian_result_rejected';
end $$;
alter function public.finish_marketing_agent_run(uuid,jsonb,jsonb,jsonb,text) rename to finish_marketing_agent_run_before_diagnostics;
alter function public.finish_marketing_agent_run_before_diagnostics(uuid,jsonb,jsonb,jsonb,text) set schema marketing;
create function public.finish_marketing_agent_run(p_id uuid,p_output jsonb,p_qa jsonb,p_usage jsonb,p_error text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r marketing.agent_runs; result jsonb; reason text; failure text:=p_error;
begin
 select * into r from marketing.agent_runs where id=p_id for update;
 if r.status='started' and r.agent_key='guardian' then reason:=marketing.guardian_failure_reason(p_id,p_output,p_error); end if;
 if failure in ('constraint_evaluation_mismatch','guardian_output_schema_invalid') then failure:='invalid_output'; end if;
 result:=marketing.finish_marketing_agent_run_before_diagnostics(p_id,p_output,p_qa,p_usage,failure);
 if reason is not null and result->>'status'='failed' then insert into marketing.agent_run_diagnostics(agent_run_id,workspace_id,reason) values(p_id,r.workspace_id,reason) on conflict do nothing; end if;
 return result;
end $$;
create function marketing.guardian_retry_context(p_id uuid,p_human uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o marketing.task_orchestrations; r marketing.agent_runs; a marketing.assets; t marketing.campaign_tasks; c marketing.campaigns; sets jsonb; issue text; ids jsonb;
begin
 select * into o from marketing.task_orchestrations where id=p_id;
 select * into r from marketing.agent_runs where id=o.active_run_id;
 select * into a from marketing.assets where id=o.asset_id and workspace_id=o.workspace_id and campaign_id=o.campaign_id;
 select * into t from marketing.campaign_tasks where id=o.task_id;
 select * into c from marketing.campaigns where id=o.campaign_id;
 sets:=marketing.effective_constraint_sets(o.workspace_id,o.campaign_id,a.id,o.id);
 select coalesce(jsonb_agg(s->'id' order by s->>'id'),'[]') into ids from jsonb_array_elements(sets) s;
 if not exists(select 1 from marketing.workspace_members where workspace_id=o.workspace_id and user_id=p_human and role in ('contributor','approver','admin')) then issue:='You need workspace write permission to retry Guardian.';
 elsif o.state not in ('failed','blocked') or r.agent_key is distinct from 'guardian' or r.status is distinct from 'failed' then issue:='This work has no completed technical Guardian failure to retry.';
 elsif r.workspace_id<>o.workspace_id or r.campaign_id<>o.campaign_id or not(r.id=any(o.run_ids)) or r.input_metadata->'orchestration'->>'id' is distinct from o.id::text then issue:='The review cannot be linked safely to this work. Inspect the technical history.';
 elsif t.revision is distinct from o.task_revision or t.revision is distinct from (r.input_metadata->'task'->>'revision')::integer or t.status not in ('todo','in_progress') then issue:='The task changed. Refresh and review its scope before continuing.';
 elsif c.revision is distinct from o.campaign_revision or c.revision is distinct from (r.input_metadata->'campaign'->>'revision')::integer then issue:='The campaign changed. Refresh and review its brief before continuing.';
 elsif a.id is null or a.id is distinct from (r.input_metadata->'asset'->>'id')::uuid or a.revision is distinct from o.asset_revision or a.revision is distinct from (r.input_metadata->'asset'->>'revision')::integer or a.approval_state<>'draft' or a.publication_state<>'unpublished' then issue:='The asset changed. Refresh and review the current content before continuing.';
 elsif sets is distinct from coalesce(r.input_metadata->'human_constraint_sets','[]') then issue:='Marketing Policy changed. Refresh and review the current rules before continuing.';
 elsif exists(select 1 from jsonb_array_elements(marketing.evaluate_human_constraints(a.content,sets)) q where q->>'passed'='false') then issue:='Current content has a Marketing Policy issue. Review it before continuing.';
 elsif exists(select 1 from marketing.agent_runs ar where ar.id=any(o.run_ids) and ar.status='started') then issue:='A stage is still active or uncertain. Inspect it before retrying.';
 elsif exists(select 1 from marketing.task_orchestrations other where other.id<>o.id and (other.asset_id=a.id or other.task_id=o.task_id and other.state not in ('completed','failed','blocked','cancelled'))) then issue:='Another workflow owns this work. Inspect it before continuing.';
 end if;
 return jsonb_build_object('eligible',issue is null,'reason',issue,'orchestration_id',o.id,'expected_revision',o.revision,'asset_revision',a.revision,'task_revision',t.revision,'campaign_revision',c.revision,'constraint_set_ids',ids);
end $$;

create or replace function marketing.audit_orchestration() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='DELETE' then raise exception 'Orchestration history is immutable'; end if;
 if TG_OP='UPDATE' then
  if (new.id,new.workspace_id,new.campaign_id,new.task_id,new.initiated_by,new.workflow,new.task_revision,new.campaign_revision,new.asset_type,new.started_at)
   is distinct from (old.id,old.workspace_id,old.campaign_id,old.task_id,old.initiated_by,old.workflow,old.task_revision,old.campaign_revision,old.asset_type,old.started_at)
   then raise exception 'Orchestration identity is immutable'; end if;
  if old.state in ('completed','blocked','failed','cancelled') and not (
    (old.state in ('failed','blocked') and new.state='creator_running' and new.revision=old.revision+1
    and new.revision_cycles=old.revision_cycles+1 and new.asset_id=old.asset_id and new.completed_at is null
    and exists(select 1 from marketing.orchestration_revision_authorizations h where h.orchestration_id=old.id
     and h.workspace_id=old.workspace_id and h.from_revision=old.revision and h.from_state=old.state
     and h.actor_user_id=new.last_actor_user_id and h.asset_revision=new.asset_revision and h.revision_cycle=new.revision_cycles
     and h.instructions=new.instructions)) or (
     old.state in ('failed','blocked') and new.state='guardian_running' and new.revision=old.revision+1
     and new.revision_cycles=old.revision_cycles and new.asset_id=old.asset_id and new.asset_revision=old.asset_revision and new.completed_at is null
     and new.run_ids=array_append(old.run_ids,new.active_run_id)
     and exists(select 1 from marketing.guardian_retry_authorizations h where h.orchestration_id=old.id and h.from_revision=old.revision
      and h.prior_run_id=old.active_run_id and h.new_run_id=new.active_run_id and h.actor_user_id=new.last_actor_user_id and h.asset_revision=new.asset_revision))) then raise exception 'Terminal history is immutable without a human revision authorization'; end if;
 end if;
 insert into marketing.orchestration_history(orchestration_id,workspace_id,actor_user_id,snapshot)
 values(new.id,new.workspace_id,new.last_actor_user_id,to_jsonb(new));
 return new;
end $$;
alter function public.command_marketing_orchestration(uuid,jsonb) rename to command_marketing_orchestration_before_guardian_retry;
alter function public.command_marketing_orchestration_before_guardian_retry(uuid,jsonb) set schema marketing;
create function public.command_marketing_orchestration(p_human uuid,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o marketing.task_orchestrations; ctx jsonb; sets jsonb; supplied jsonb; run_id uuid:=gen_random_uuid(); run_context jsonb; w uuid:=(p_request->>'workspace_id')::uuid;
begin
 if p_request->>'action' is distinct from 'retry_guardian' then return marketing.command_marketing_orchestration_before_guardian_retry(p_human,p_request); end if;
 perform 1 from marketing.workspace_members where workspace_id=w and user_id=p_human and role in ('contributor','approver','admin') for share;
 if not found then raise exception 'Workspace write permission required' using errcode='42501'; end if;
 if exists(select 1 from jsonb_object_keys(p_request) k where k not in ('workspace_id','id','action','expected_revision','asset_revision','task_revision','campaign_revision','constraint_set_ids')) or jsonb_typeof(p_request->'constraint_set_ids') is distinct from 'array' then raise exception 'Invalid Guardian retry command'; end if;
 select * into o from marketing.task_orchestrations where id=(p_request->>'id')::uuid and workspace_id=w for update;
 if not found then raise exception 'Work unavailable' using errcode='42501'; end if;
 if (p_request->>'expected_revision')::integer is distinct from o.revision then return jsonb_build_object('orchestration',to_jsonb(o)); end if;
 perform 1 from marketing.campaign_tasks where id=o.task_id for update;
 perform 1 from marketing.campaigns where id=o.campaign_id for share;
 perform 1 from marketing.assets where id=o.asset_id for update;
 perform 1 from marketing.workspaces where id=w for share;
 ctx:=marketing.guardian_retry_context(o.id,p_human);
 if not(ctx->>'eligible')::boolean then raise exception using message=ctx->>'reason',errcode='40001'; end if;
 select coalesce(jsonb_agg(to_jsonb(value::uuid::text) order by value::uuid::text),'[]') into supplied from jsonb_array_elements_text(p_request->'constraint_set_ids');
 if (p_request->>'asset_revision')::integer is distinct from (ctx->>'asset_revision')::integer or (p_request->>'task_revision')::integer is distinct from (ctx->>'task_revision')::integer or (p_request->>'campaign_revision')::integer is distinct from (ctx->>'campaign_revision')::integer or supplied is distinct from ctx->'constraint_set_ids' then raise exception 'Review context changed. Refresh before retrying.' using errcode='40001'; end if;
 sets:=marketing.effective_constraint_sets(w,o.campaign_id,o.asset_id,o.id);
 insert into marketing.guardian_retry_authorizations(workspace_id,orchestration_id,actor_user_id,from_revision,prior_run_id,new_run_id,asset_revision,policy_snapshot)
 values(w,o.id,p_human,o.revision,o.active_run_id,run_id,o.asset_revision,sets);
 update marketing.task_orchestrations set state='guardian_running',active_run_id=run_id,run_ids=array_append(run_ids,run_id),revision=revision+1,
  reason=null,completed_at=null,updated_at=now(),last_actor_user_id=p_human where id=o.id returning * into o;
 run_context:=public.start_marketing_agent_run(run_id,p_human,jsonb_build_object('workspace_id',w,'campaign_id',o.campaign_id,'agent_key','guardian','purpose','Retry review of the unchanged task asset','asset_id',o.asset_id),'marketing-policy-v1','gpt-4.1-mini');
 return jsonb_build_object('orchestration',to_jsonb(o),'run',jsonb_build_object('id',run_id,'context',run_context));
end $$;
-- A delayed failure callback from the predecessor must not cancel its retry.
alter function public.finish_marketing_orchestration_stage(uuid,uuid,jsonb,jsonb,jsonb,text) rename to finish_marketing_orchestration_stage_before_guardian_retry;
alter function public.finish_marketing_orchestration_stage_before_guardian_retry(uuid,uuid,jsonb,jsonb,jsonb,text) set schema marketing;
create function public.finish_marketing_orchestration_stage(p_id uuid,p_run uuid,p_output jsonb,p_qa jsonb,p_usage jsonb,p_error text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o marketing.task_orchestrations;
begin
 select * into o from marketing.task_orchestrations where id=p_id for update;
 if o.active_run_id is distinct from p_run and exists(select 1 from marketing.guardian_retry_authorizations where orchestration_id=o.id and prior_run_id=p_run) then return jsonb_build_object('orchestration',to_jsonb(o)); end if;
 return marketing.finish_marketing_orchestration_stage_before_guardian_retry(p_id,p_run,p_output,p_qa,p_usage,p_error);
end $$;
create function marketing.guardian_run_evidence(p_run uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'agent_key',r.agent_key,'status',r.status,'error_code',r.error_code,
  'technical_reason',coalesce(d.reason,case when r.status='failed' then case r.error_code when 'invalid_output' then 'guardian_output_schema_invalid' when 'model_failed' then 'guardian_model_failed' when 'persistence_failed' then 'guardian_persistence_failed' else 'guardian_result_rejected' end end),
  'asset_revision',r.input_metadata->'asset'->'revision','policy_versions',coalesce((select jsonb_agg(jsonb_build_object('id',s->'id','source_scope',s->'source_scope')) from jsonb_array_elements(coalesce(r.input_metadata->'human_constraint_sets','[]')) s),'[]'),
  'started_at',r.started_at,'ended_at',r.ended_at,'retry_of',(select prior_run_id from marketing.guardian_retry_authorizations where new_run_id=r.id),
  'recommendation',r.output_metadata->'result'->'recommendation','findings',coalesce(r.output_metadata->'result'->'findings','[]'),
  'constraint_evaluations',coalesce(r.output_metadata->'result'->'constraint_evaluations','[]'))
 from marketing.agent_runs r left join marketing.agent_run_diagnostics d on d.agent_run_id=r.id where r.id=p_run and r.agent_key='guardian'
$$;
alter function marketing.guided_work_context(uuid,uuid) rename to guided_work_context_before_guardian_retry;
create function marketing.guided_work_context(p_id uuid,p_human uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; o marketing.task_orchestrations; g jsonb; retry jsonb; role_name text;
begin
 result:=marketing.guided_work_context_before_guardian_retry(p_id,p_human);
 select * into o from marketing.task_orchestrations where id=p_id;
 g:=marketing.guardian_run_evidence(o.active_run_id); retry:=marketing.guardian_retry_context(p_id,p_human);
 select role into role_name from marketing.workspace_members where workspace_id=o.workspace_id and user_id=p_human;
 if g->>'status'='failed' and o.state in ('failed','blocked') then
  result:=result||jsonb_build_object('actions',case when (retry->>'eligible')::boolean then '["retry_guardian"]'::jsonb else '[]'::jsonb end,
   'reason',case when (retry->>'eligible')::boolean then 'Automated policy checks passed, but Guardian could not complete its review. Retry the review without changing the content.' else retry->>'reason' end);
 elsif g->>'status'='succeeded' and g->>'recommendation'='needs_changes' and o.state in ('changes_needed','blocked') then
  result:=result||jsonb_build_object('actions',case when result->'actions' ? 'request_changes' then '["request_changes"]'::jsonb else '[]'::jsonb end,
   'reason','Automated policy checks passed. Guardian recommends changes before approval.');
 end if;
 return result||jsonb_build_object('guardian',g,'guardian_retry',retry);
end $$;
alter function public.read_marketing_agent_run(uuid,uuid) rename to read_marketing_agent_run_before_guardian_retry;
alter function public.read_marketing_agent_run_before_guardian_retry(uuid,uuid) set schema marketing;
create function public.read_marketing_agent_run(p_workspace uuid,p_run uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=marketing.read_marketing_agent_run_before_guardian_retry(p_workspace,p_run);
 return result||jsonb_build_object('guardian_evidence',marketing.guardian_run_evidence(p_run));
end $$;
revoke all on function marketing.guardian_failure_reason(uuid,jsonb,text),marketing.guardian_retry_context(uuid,uuid),marketing.guardian_run_evidence(uuid),marketing.guided_work_context_before_guardian_retry(uuid,uuid),marketing.guided_work_context(uuid,uuid),marketing.finish_marketing_agent_run_before_diagnostics(uuid,jsonb,jsonb,jsonb,text),marketing.command_marketing_orchestration_before_guardian_retry(uuid,jsonb),marketing.finish_marketing_orchestration_stage_before_guardian_retry(uuid,uuid,jsonb,jsonb,jsonb,text),marketing.read_marketing_agent_run_before_guardian_retry(uuid,uuid),public.finish_marketing_agent_run(uuid,jsonb,jsonb,jsonb,text),public.command_marketing_orchestration(uuid,jsonb),public.finish_marketing_orchestration_stage(uuid,uuid,jsonb,jsonb,jsonb,text),public.read_marketing_agent_run(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.finish_marketing_agent_run(uuid,jsonb,jsonb,jsonb,text),public.command_marketing_orchestration(uuid,jsonb),public.finish_marketing_orchestration_stage(uuid,uuid,jsonb,jsonb,jsonb,text) to service_role;
grant execute on function public.read_marketing_agent_run(uuid,uuid) to authenticated;
commit;
