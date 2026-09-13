begin;
create index orchestration_asset_lineage on marketing.task_orchestrations(asset_id) where asset_id is not null;
-- Authorizations are evidence, not a mutable recovery flag or a second workflow.
create table marketing.orchestration_revision_authorizations (
 id bigint generated always as identity primary key,
 orchestration_id uuid not null references marketing.task_orchestrations(id),
 workspace_id uuid not null references marketing.workspaces(id),
 actor_user_id uuid not null references auth.users(id),
 from_revision integer not null, from_state text not null,
 asset_revision integer not null, revision_cycle integer not null check(revision_cycle between 1 and 3),
 human_decision_id bigint references marketing.workflow_history(id),
 constraint_set_ids jsonb not null, instructions text not null,
 occurred_at timestamptz not null default now(),
 unique(orchestration_id,from_revision), unique(orchestration_id,revision_cycle)
);
alter table marketing.orchestration_revision_authorizations enable row level security;
revoke all on marketing.orchestration_revision_authorizations from public,anon,authenticated,service_role;
create trigger immutable_revision_authorizations before update or delete on marketing.orchestration_revision_authorizations
 for each row execute function marketing.prevent_audit_mutation();

create function marketing.orchestration_revision_context(p_id uuid,p_human uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o marketing.task_orchestrations; a marketing.assets; t marketing.campaign_tasks; c marketing.campaigns;
 d marketing.workflow_history; g marketing.agent_runs; reason text; sets jsonb;
begin
 select * into o from marketing.task_orchestrations where id=p_id;
 select * into a from marketing.assets where id=o.asset_id and workspace_id=o.workspace_id and campaign_id=o.campaign_id;
 select * into t from marketing.campaign_tasks where id=o.task_id and workspace_id=o.workspace_id and campaign_id=o.campaign_id;
 select * into c from marketing.campaigns where id=o.campaign_id and workspace_id=o.workspace_id;
 select * into g from marketing.agent_runs where id=o.active_run_id and workspace_id=o.workspace_id and campaign_id=o.campaign_id;
 select * into d from marketing.workflow_history where workspace_id=o.workspace_id and asset_id=a.id and actor_type='human' and action='changes_requested' order by id desc limit 1;
 select coalesce(jsonb_agg(s->'id' order by s->>'id'),'[]') into sets from jsonb_array_elements(marketing.applicable_constraint_sets(o.workspace_id,a.id,o.id)) s;
 if not exists(select 1 from marketing.workspace_members where workspace_id=o.workspace_id and user_id=p_human and role in ('contributor','approver','admin')) then reason:='Workspace write permission required';
 elsif o.state in ('cancelled','completed') then reason:='Workflow is closed; start a new orchestration';
 elsif o.revision_cycles>=3 then reason:='Three revision cycles exhausted; review manually or start a new orchestration';
 elsif t.id is null or c.id is null or t.status not in ('todo','in_progress') or t.revision<>o.task_revision or c.revision<>o.campaign_revision then reason:='Task or campaign changed; start a new orchestration';
 elsif g.id is null or not(g.id=any(o.run_ids)) or g.input_metadata->'orchestration'->>'id' is distinct from o.id::text
  or a.id is null or a.created_via<>'agent' or a.asset_type<>o.asset_type or a.publication_state<>'unpublished'
  or not exists(select 1 from marketing.agent_runs r where r.id=any(o.run_ids) and r.workspace_id=o.workspace_id and r.campaign_id=o.campaign_id and r.agent_key='creator' and r.status='succeeded' and r.outcome_asset_id=a.id and r.input_metadata->'orchestration'->>'id'=o.id::text)
  or exists(select 1 from marketing.task_orchestrations other where other.id<>o.id and other.asset_id=a.id) then reason:='Asset lineage unavailable or ambiguous; start a new orchestration';
 elsif exists(select 1 from marketing.task_orchestrations other where other.id<>o.id and other.task_id=o.task_id and other.state not in ('completed','blocked','failed','cancelled')) then reason:='Another workflow is active for this task';
 elsif exists(select 1 from marketing.agent_runs r where r.id=any(o.run_ids) and r.status='started') then reason:='A stage is active or uncertain; inspect before restarting';
 elsif o.state='failed' and (g.agent_key is distinct from 'guardian' or g.status is distinct from 'failed' or coalesce(g.error_code,'') not in ('result_rejected','invalid_output','persistence_failed','model_failed')) then reason:='Failure cannot be recovered with a Creator revision';
 elsif o.state not in ('changes_needed','failed','blocked') or (o.state='blocked' and o.reason is distinct from 'Human constraint failed') then reason:='Revision is unavailable in this workflow state';
 elsif a.approval_state='changes_requested' then
  if d.id is null or (d.snapshot->>'revision')::integer<>a.revision or length(trim(coalesce(d.notes,'')))=0 then reason:='Current human requested-change evidence is required'; end if;
 elsif not(o.state='changes_needed' and a.approval_state='draft' and a.revision=o.asset_revision) then reason:='Record human requested changes on the current asset before recovery';
 end if;
 return jsonb_build_object('orchestration_id',o.id,'eligible',reason is null,'reason',reason,
  'asset_revision',a.revision,'task_revision',t.revision,'campaign_revision',c.revision,'constraint_set_ids',sets,
  'human_change_request',case when d.id is null then null else jsonb_build_object('id',d.id,'notes',d.notes,'revision',d.snapshot->'revision','actor_user_id',d.actor_user_id,'occurred_at',d.occurred_at) end);
end $$;

create or replace function marketing.audit_orchestration() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='DELETE' then raise exception 'Orchestration history is immutable'; end if;
 if TG_OP='UPDATE' then
  if (new.id,new.workspace_id,new.campaign_id,new.task_id,new.initiated_by,new.workflow,new.task_revision,new.campaign_revision,new.asset_type,new.started_at)
   is distinct from (old.id,old.workspace_id,old.campaign_id,old.task_id,old.initiated_by,old.workflow,old.task_revision,old.campaign_revision,old.asset_type,old.started_at)
   then raise exception 'Orchestration identity is immutable'; end if;
  if old.state in ('completed','blocked','failed','cancelled') and not (
    old.state in ('failed','blocked') and new.state='creator_running' and new.revision=old.revision+1
    and new.revision_cycles=old.revision_cycles+1 and new.asset_id=old.asset_id and new.completed_at is null
    and exists(select 1 from marketing.orchestration_revision_authorizations h where h.orchestration_id=old.id
     and h.workspace_id=old.workspace_id and h.from_revision=old.revision and h.from_state=old.state
     and h.actor_user_id=new.last_actor_user_id and h.asset_revision=new.asset_revision and h.revision_cycle=new.revision_cycles
     and h.instructions=new.instructions)) then raise exception 'Terminal history is immutable without a human revision authorization'; end if;
 end if;
 insert into marketing.orchestration_history(orchestration_id,workspace_id,actor_user_id,snapshot)
 values(new.id,new.workspace_id,new.last_actor_user_id,to_jsonb(new));
 return new;
end $$;

alter function public.command_marketing_orchestration(uuid,jsonb) rename to command_marketing_orchestration_before_recovery;
alter function public.command_marketing_orchestration_before_recovery(uuid,jsonb) set schema marketing;
create function public.command_marketing_orchestration(p_human uuid,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o marketing.task_orchestrations; context jsonb; supplied_sets jsonb; w uuid:=(p_request->>'workspace_id')::uuid;
begin
 if p_request->>'action' is distinct from 'revise' then return marketing.command_marketing_orchestration_before_recovery(p_human,p_request); end if;
 perform 1 from marketing.workspace_members where workspace_id=w and user_id=p_human and role in ('contributor','approver','admin') for share;
 if not found then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 if exists(select 1 from jsonb_object_keys(p_request) k where k not in ('workspace_id','id','action','expected_revision','asset_revision','task_revision','campaign_revision','constraint_set_ids','instructions'))
  or jsonb_typeof(p_request->'constraint_set_ids') is distinct from 'array' or jsonb_array_length(p_request->'constraint_set_ids')>30
  or length(coalesce(p_request->>'instructions',''))>4000 then raise exception 'Invalid revision command'; end if;
 select * into o from marketing.task_orchestrations where id=(p_request->>'id')::uuid and workspace_id=w for update;
 if not found then raise exception 'Orchestration unavailable' using errcode='42501'; end if;
 -- Replaying the original request returns current evidence, never another stage ownership token.
 if (p_request->>'expected_revision')::integer is distinct from o.revision then return jsonb_build_object('orchestration',to_jsonb(o)); end if;
 perform 1 from marketing.campaign_tasks where id=o.task_id for update;
 perform 1 from marketing.campaigns where id=o.campaign_id for share;
 perform 1 from marketing.assets where id=o.asset_id for update;
 context:=marketing.orchestration_revision_context(o.id,p_human);
 if not (context->>'eligible')::boolean then raise exception 'Revision unavailable: %',context->>'reason' using errcode='40001'; end if;
 select coalesce(jsonb_agg(to_jsonb(value::uuid::text) order by value::uuid::text),'[]') into supplied_sets from jsonb_array_elements_text(p_request->'constraint_set_ids');
 if (p_request->>'asset_revision')::integer is distinct from (context->>'asset_revision')::integer
  or (p_request->>'task_revision')::integer is distinct from o.task_revision
  or (p_request->>'campaign_revision')::integer is distinct from o.campaign_revision
  or supplied_sets is distinct from context->'constraint_set_ids' then raise exception 'Revision context changed; refresh required' using errcode='40001'; end if;
 perform set_config('request.jwt.claim.sub',p_human::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_human)::text,true);
 insert into marketing.orchestration_revision_authorizations(orchestration_id,workspace_id,actor_user_id,from_revision,from_state,asset_revision,revision_cycle,human_decision_id,constraint_set_ids,instructions)
 values(o.id,w,p_human,o.revision,o.state,(context->>'asset_revision')::integer,o.revision_cycles+1,(context->'human_change_request'->>'id')::bigint,supplied_sets,coalesce(p_request->>'instructions',''));
 update marketing.task_orchestrations set state='creator_running',asset_revision=(context->>'asset_revision')::integer,
  revision_cycles=revision_cycles+1,instructions=coalesce(p_request->>'instructions',''),last_actor_user_id=p_human,
  reason='Human authorized Creator revision',completed_at=null,revision=revision+1,updated_at=now(),constraint_preflight='[]' where id=o.id;
 return marketing.start_orchestration_stage(o.id,'creator',p_human);
end $$;

-- Prevent both new and already-started standalone revisions from orphaning task-owned assets.
alter function public.start_marketing_agent_run(uuid,uuid,jsonb,text,text) rename to start_marketing_agent_run_before_recovery;
alter function public.start_marketing_agent_run_before_recovery(uuid,uuid,jsonb,text,text) set schema marketing;
create function public.start_marketing_agent_run(p_id uuid,p_human uuid,p_request jsonb,p_version text,p_model text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_request ? 'revision_asset_id' and exists(select 1 from marketing.task_orchestrations where asset_id=(p_request->>'revision_asset_id')::uuid)
  and not exists(select 1 from marketing.task_orchestrations where active_run_id=p_id and state='creator_running'
   and asset_id=(p_request->>'revision_asset_id')::uuid and workspace_id=(p_request->>'workspace_id')::uuid and campaign_id=(p_request->>'campaign_id')::uuid)
  then raise exception 'This asset belongs to a task workflow; use Revise with Agent Team' using errcode='42501'; end if;
 return marketing.start_marketing_agent_run_before_recovery(p_id,p_human,p_request,p_version,p_model);
end $$;
alter function public.finish_marketing_agent_run(uuid,jsonb,jsonb,jsonb,text) rename to finish_marketing_agent_run_before_recovery;
alter function public.finish_marketing_agent_run_before_recovery(uuid,jsonb,jsonb,jsonb,text) set schema marketing;
create function public.finish_marketing_agent_run(p_id uuid,p_output jsonb,p_qa jsonb,p_usage jsonb,p_error text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r marketing.agent_runs;
begin
 select * into r from marketing.agent_runs where id=p_id;
 if r.agent_key='creator' and r.input_metadata->'request' ? 'revision_asset_id'
  and exists(select 1 from marketing.task_orchestrations where asset_id=(r.input_metadata->'request'->>'revision_asset_id')::uuid)
  and not exists(select 1 from marketing.task_orchestrations where id=(r.input_metadata->'orchestration'->>'id')::uuid
   and active_run_id=r.id and state='creator_running' and asset_id=(r.input_metadata->'request'->>'revision_asset_id')::uuid)
  then p_error:='result_rejected'; end if;
 return marketing.finish_marketing_agent_run_before_recovery(p_id,p_output,p_qa,p_usage,p_error);
end $$;

-- An old failed stage callback cannot cancel a later, explicitly authorized cycle.
alter function public.finish_marketing_orchestration_stage(uuid,uuid,jsonb,jsonb,jsonb,text) rename to finish_marketing_orchestration_stage_before_recovery;
alter function public.finish_marketing_orchestration_stage_before_recovery(uuid,uuid,jsonb,jsonb,jsonb,text) set schema marketing;
create function public.finish_marketing_orchestration_stage(p_id uuid,p_run uuid,p_output jsonb,p_qa jsonb,p_usage jsonb,p_error text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o marketing.task_orchestrations;
begin
 select * into o from marketing.task_orchestrations where id=p_id for update;
 if o.active_run_id is distinct from p_run and exists(select 1 from marketing.agent_runs r where r.id=p_run and r.id=any(o.run_ids)
  and r.input_metadata->'orchestration'->>'id'=o.id::text and (r.input_metadata->'orchestration'->>'revision_cycles')::integer<o.revision_cycles)
  then return jsonb_build_object('orchestration',to_jsonb(o)); end if;
 return marketing.finish_marketing_orchestration_stage_before_recovery(p_id,p_run,p_output,p_qa,p_usage,p_error);
end $$;
revoke all on function marketing.finish_marketing_orchestration_stage_before_recovery(uuid,uuid,jsonb,jsonb,jsonb,text),public.finish_marketing_orchestration_stage(uuid,uuid,jsonb,jsonb,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.finish_marketing_orchestration_stage(uuid,uuid,jsonb,jsonb,jsonb,text) to service_role;

alter function public.read_marketing_attention_workspace(uuid) rename to read_marketing_attention_workspace_before_recovery;
alter function public.read_marketing_attention_workspace_before_recovery(uuid) set schema marketing;
create function public.read_marketing_attention_workspace(p_workspace uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; w uuid;
begin
 result:=marketing.read_marketing_attention_workspace_before_recovery(p_workspace);
 w:=(result->'workspace'->>'id')::uuid;
 return result||jsonb_build_object('orchestration_recovery',coalesce((select jsonb_agg(marketing.orchestration_revision_context(o.id,auth.uid())) from marketing.task_orchestrations o where workspace_id=w),'[]'::jsonb));
end $$;
revoke all on function marketing.orchestration_revision_context(uuid,uuid),marketing.command_marketing_orchestration_before_recovery(uuid,jsonb),
 marketing.start_marketing_agent_run_before_recovery(uuid,uuid,jsonb,text,text),marketing.finish_marketing_agent_run_before_recovery(uuid,jsonb,jsonb,jsonb,text),
 marketing.read_marketing_attention_workspace_before_recovery(uuid),public.command_marketing_orchestration(uuid,jsonb),
 public.start_marketing_agent_run(uuid,uuid,jsonb,text,text),public.finish_marketing_agent_run(uuid,jsonb,jsonb,jsonb,text),public.read_marketing_attention_workspace(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.command_marketing_orchestration(uuid,jsonb),public.start_marketing_agent_run(uuid,uuid,jsonb,text,text),public.finish_marketing_agent_run(uuid,jsonb,jsonb,jsonb,text) to service_role;
grant execute on function public.read_marketing_attention_workspace(uuid) to authenticated;
commit;
