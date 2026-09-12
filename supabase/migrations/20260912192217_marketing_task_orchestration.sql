begin;
create table marketing.task_orchestrations (
 id uuid primary key, workspace_id uuid not null, campaign_id uuid not null,
 task_id uuid not null references marketing.campaign_tasks(id), initiated_by uuid not null references auth.users(id),
 workflow text not null check(workflow in ('strategist','creator_guardian','strategist_creator_guardian')),
 state text not null check(state in ('strategist_running','awaiting_plan','creator_running','guardian_running','awaiting_review','changes_needed','awaiting_approval','completed','blocked','failed','cancelled')),
 task_revision integer not null, campaign_revision integer not null, revision integer not null default 1,
 asset_type text not null check(asset_type in ('social_copy','email_copy','web_copy','print_copy','image_brief','video_brief')),
 active_run_id uuid, run_ids uuid[] not null default '{}', plan_run_id uuid references marketing.agent_runs(id),
 asset_id uuid references marketing.assets(id), asset_revision integer,
 revision_cycles integer not null default 0 check(revision_cycles between 0 and 3),
 instructions text not null default '' check(length(instructions)<=4000),
 last_actor_user_id uuid references auth.users(id), reason text,
 started_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz,
 foreign key(workspace_id,campaign_id) references marketing.campaigns(workspace_id,id)
);
create unique index one_active_task_orchestration on marketing.task_orchestrations(task_id)
 where state not in ('completed','blocked','failed','cancelled');
create table marketing.orchestration_history (
 id bigint generated always as identity primary key,
 orchestration_id uuid not null references marketing.task_orchestrations(id),
 workspace_id uuid not null, actor_user_id uuid references auth.users(id),
 snapshot jsonb not null, occurred_at timestamptz not null default now()
);
alter table marketing.task_orchestrations enable row level security;
alter table marketing.orchestration_history enable row level security;
revoke all on marketing.task_orchestrations,marketing.orchestration_history from public,anon,authenticated,service_role;
create index orchestration_workspace on marketing.task_orchestrations(workspace_id);
create index orchestration_timeline on marketing.orchestration_history(orchestration_id,id);
create trigger immutable_orchestration_history before update or delete on marketing.orchestration_history
 for each row execute function marketing.prevent_audit_mutation();
create function marketing.audit_orchestration() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='DELETE' then raise exception 'Orchestration history is immutable'; end if;
 if TG_OP='UPDATE' then
  if old.state in ('completed','blocked','failed','cancelled') or
   (new.id,new.workspace_id,new.campaign_id,new.task_id,new.initiated_by,new.workflow,new.task_revision,new.campaign_revision,new.asset_type,new.started_at)
   is distinct from (old.id,old.workspace_id,old.campaign_id,old.task_id,old.initiated_by,old.workflow,old.task_revision,old.campaign_revision,old.asset_type,old.started_at)
   then raise exception 'Orchestration identity and terminal history are immutable'; end if;
 end if;
 insert into marketing.orchestration_history(orchestration_id,workspace_id,actor_user_id,snapshot)
 values(new.id,new.workspace_id,new.last_actor_user_id,to_jsonb(new));
 return new;
end $$;
create trigger audit_task_orchestration after insert or update or delete on marketing.task_orchestrations
 for each row execute function marketing.audit_orchestration();

-- Private stage creation: workflow and agent identities are chosen by deterministic transitions.
create function marketing.start_orchestration_stage(p_id uuid,p_agent text,p_human uuid) returns jsonb
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
 context:=public.start_marketing_agent_run(run_id,p_human,request,'marketing-v2','gpt-4.1-mini');
 return jsonb_build_object('orchestration',to_jsonb(o),'run',jsonb_build_object('id',run_id,'context',context));
end $$;

create function public.command_marketing_orchestration(p_human uuid,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o marketing.task_orchestrations; t marketing.campaign_tasks; c marketing.campaigns; a marketing.assets;
 w uuid:=(p_request->>'workspace_id')::uuid; oid uuid:=(p_request->>'id')::uuid; action text:=p_request->>'action'; g marketing.agent_runs;
begin
 perform 1 from marketing.workspace_members where workspace_id=w and user_id=p_human and role in ('contributor','approver','admin') for share;
 if not found then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 if exists(select 1 from jsonb_object_keys(p_request) k where k not in ('workspace_id','id','action','campaign_id','task_id','task_revision','campaign_revision','workflow','asset_type','expected_revision','instructions'))
  or length(coalesce(p_request->>'instructions',''))>4000 then raise exception 'Invalid orchestration request'; end if;
 perform set_config('request.jwt.claim.sub',p_human::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_human)::text,true);
 select * into o from marketing.task_orchestrations where id=oid for update;
 if found then
  if o.workspace_id<>w then raise exception 'Orchestration unavailable' using errcode='42501'; end if;
  if action='start' then return jsonb_build_object('orchestration',to_jsonb(o)); end if;
  if (p_request->>'expected_revision')::integer is distinct from o.revision then return jsonb_build_object('orchestration',to_jsonb(o)); end if;
 elsif action='start' then
  select * into t from marketing.campaign_tasks where id=(p_request->>'task_id')::uuid and workspace_id=w and campaign_id=(p_request->>'campaign_id')::uuid for update;
  if not found then raise exception 'Task unavailable' using errcode='42501'; end if;
  select * into c from marketing.campaigns where id=t.campaign_id and workspace_id=w for share;
  if t.status not in ('todo','in_progress') or t.revision is distinct from (p_request->>'task_revision')::integer
   or c.revision is distinct from (p_request->>'campaign_revision')::integer then raise exception 'Stale or ineligible task' using errcode='40001'; end if;
  insert into marketing.task_orchestrations(id,workspace_id,campaign_id,task_id,initiated_by,workflow,state,task_revision,campaign_revision,asset_type,instructions,last_actor_user_id)
  values(oid,w,c.id,t.id,p_human,p_request->>'workflow',case when p_request->>'workflow'='creator_guardian' then 'creator_running' else 'strategist_running' end,t.revision,c.revision,p_request->>'asset_type',coalesce(p_request->>'instructions',''),p_human) returning * into o;
  return marketing.start_orchestration_stage(o.id,case when o.workflow='creator_guardian' then 'creator' else 'strategist' end,p_human);
 else raise exception 'Orchestration unavailable' using errcode='42501'; end if;
 select * into t from marketing.campaign_tasks where id=o.task_id for update;
 select * into c from marketing.campaigns where id=o.campaign_id for share;
 select * into a from marketing.assets where id=o.asset_id for update;
 if action='complete_task' and o.state='completed' then
  if t.status='done' then return jsonb_build_object('orchestration',to_jsonb(o)); end if;
  if t.revision<>o.task_revision then raise exception 'Task changed; inspect manually'; end if;
  perform public.save_marketing_task(w,o.campaign_id,t.id,t.revision,jsonb_build_object('title',t.title,'status','done','owner_user_id',t.owner_user_id,'due_on',t.due_on));
  return jsonb_build_object('orchestration',to_jsonb(o));
 end if;
 if o.state in ('completed','blocked','failed','cancelled') then return jsonb_build_object('orchestration',to_jsonb(o)); end if;
 if action='stop' then
  if o.state in ('strategist_running','creator_running','guardian_running') then perform public.finish_marketing_agent_run(o.active_run_id,null,'[]','{}','result_rejected'); end if;
  update marketing.task_orchestrations set state='cancelled',reason='Stopped by human',completed_at=now(),last_actor_user_id=p_human,revision=revision+1,updated_at=now() where id=o.id returning * into o;
  return jsonb_build_object('orchestration',to_jsonb(o));
 end if;
 if t.revision<>o.task_revision or c.revision<>o.campaign_revision or
  (o.asset_id is not null and a.revision is distinct from o.asset_revision and not(o.state='awaiting_approval' and a.approval_state in ('approved','changes_requested') and a.revision=o.asset_revision+1)) then
  update marketing.task_orchestrations set state='blocked',reason='Task, campaign or asset changed; inspect before restarting',completed_at=now(),last_actor_user_id=p_human,revision=revision+1,updated_at=now() where id=o.id returning * into o;
 elsif action='inspect' and o.state in ('strategist_running','creator_running','guardian_running') and o.updated_at<now()-interval '2 minutes' then
  update marketing.task_orchestrations set state='blocked',reason='Stage outcome uncertain; inspect run before restarting',completed_at=now(),last_actor_user_id=p_human,revision=revision+1,updated_at=now() where id=o.id returning * into o;
 elsif action='inspect' and o.state='awaiting_approval' and a.approval_state in ('approved','changes_requested') then
  update marketing.task_orchestrations set state=case when a.approval_state='approved' then 'completed' else 'changes_needed' end,
   asset_revision=a.revision,completed_at=case when a.approval_state='approved' then now() else null end,
   last_actor_user_id=p_human,revision=revision+1,updated_at=now() where id=o.id returning * into o;
 elsif action='accept' and o.state='awaiting_plan' then
  if not exists(select 1 from marketing.agent_run_resolutions where agent_run_id=o.plan_run_id) then
   perform public.resolve_marketing_agent_run(w,o.plan_run_id,'accept_plan','[]',p_request->>'instructions');
  elsif not exists(select 1 from marketing.agent_run_resolutions where agent_run_id=o.plan_run_id and action in ('accept_plan','create_tasks')) then raise exception 'Plan dismissed'; end if;
  update marketing.task_orchestrations set state=case when workflow='strategist' then 'completed' else state end,
   completed_at=case when workflow='strategist' then now() else null end,last_actor_user_id=p_human,revision=revision+1,updated_at=now() where id=o.id returning * into o;
  if o.workflow<>'strategist' then return marketing.start_orchestration_stage(o.id,'creator',p_human); end if;
 elsif action='submit' and o.state='awaiting_review' then
  perform public.resolve_marketing_agent_run(w,o.active_run_id,'send_to_approval','[]',p_request->>'instructions');
  update marketing.task_orchestrations set state='awaiting_approval',asset_revision=a.revision+1,last_actor_user_id=p_human,revision=revision+1,updated_at=now() where id=o.id returning * into o;
 elsif action='revise' and o.state='changes_needed' then
  if o.revision_cycles>=3 then
   update marketing.task_orchestrations set state='blocked',reason='Three revision cycles exhausted; review manually',completed_at=now(),last_actor_user_id=p_human,revision=revision+1,updated_at=now() where id=o.id returning * into o;
  else
   update marketing.task_orchestrations set revision_cycles=revision_cycles+1,instructions=coalesce(p_request->>'instructions',''),last_actor_user_id=p_human,revision=revision+1,updated_at=now() where id=o.id;
   return marketing.start_orchestration_stage(o.id,'creator',p_human);
  end if;
 elsif action<>'inspect' then raise exception 'Action unavailable in current state';
 end if;
 return jsonb_build_object('orchestration',to_jsonb(o));
end $$;

create function public.finish_marketing_orchestration_stage(p_id uuid,p_run uuid,p_output jsonb,p_qa jsonb,p_usage jsonb,p_error text)
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
  return marketing.start_orchestration_stage(o.id,'guardian',(r->>'initiated_by')::uuid);
 else
  update marketing.task_orchestrations set state=case when r->'output_metadata'->'result'->>'recommendation'='ready_for_human_review' then 'awaiting_review' when revision_cycles>=3 then 'blocked' else 'changes_needed' end,
   reason=case when r->'output_metadata'->'result'->>'recommendation'='needs_changes' and revision_cycles>=3 then 'Three revision cycles exhausted; review manually' else null end,
   completed_at=case when r->'output_metadata'->'result'->>'recommendation'='needs_changes' and revision_cycles>=3 then now() else null end,
   revision=revision+1,updated_at=now(),last_actor_user_id=null where id=o.id returning * into o;
 end if;
 return jsonb_build_object('orchestration',to_jsonb(o));
end $$;
revoke all on function marketing.audit_orchestration(),marketing.start_orchestration_stage(uuid,text,uuid),
 public.command_marketing_orchestration(uuid,jsonb),public.finish_marketing_orchestration_stage(uuid,uuid,jsonb,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.command_marketing_orchestration(uuid,jsonb),public.finish_marketing_orchestration_stage(uuid,uuid,jsonb,jsonb,jsonb,text) to service_role;
create or replace function public.start_marketing_agent_run(p_id uuid,p_human uuid,p_request jsonb,p_version text,p_model text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare w uuid:=(p_request->>'workspace_id')::uuid; c marketing.campaigns; a marketing.assets; context jsonb; agent text:=p_request->>'agent_key'; decision marketing.workflow_history; guardian marketing.agent_runs; orch marketing.task_orchestrations;
begin
 select * into orch from marketing.task_orchestrations where active_run_id=p_id;
 if p_human is null or not exists(select 1 from marketing.workspace_members where workspace_id=w and user_id=p_human and role in ('contributor','approver','admin')) then
  raise exception 'Marketing write access unavailable' using errcode='42501';
 end if;
 -- Lock membership until initiation commits; completion rechecks it.
 perform 1 from marketing.workspace_members where workspace_id=w and user_id=p_human for share;
 select * into c from marketing.campaigns where workspace_id=w and id=(p_request->>'campaign_id')::uuid for share;
 if not found then raise exception 'Campaign unavailable' using errcode='42501'; end if;
 if agent is null or agent not in ('strategist','creator','guardian') or p_version not in ('marketing-v1','marketing-v2') or p_version is null
 or length(trim(coalesce(p_request->>'purpose',''))) not between 1 and 4000
 or exists(select 1 from jsonb_object_keys(p_request) k where k not in ('workspace_id','campaign_id','agent_key','purpose','asset_id','asset_type','submit_for_review','revision_asset_id','expected_asset_revision','expected_campaign_revision','supplemental_instructions'))
 then raise exception 'Invalid agent request'; end if;
 if agent='creator' and not(p_request ? 'revision_asset_id') and (coalesce(p_request->>'asset_type','') not in ('social_copy','email_copy','web_copy','print_copy','image_brief','video_brief')
 or jsonb_typeof(p_request->'submit_for_review') is distinct from 'boolean') then raise exception 'Invalid Creator options'; end if;
 if p_request ? 'revision_asset_id' then
  if agent<>'creator' or jsonb_typeof(p_request->'submit_for_review') is distinct from 'boolean'
   or length(coalesce(p_request->>'supplemental_instructions',''))>4000 then raise exception 'Invalid revision request'; end if;
  select * into a from marketing.assets where workspace_id=w and campaign_id=c.id and id=(p_request->>'revision_asset_id')::uuid for share;
  if not found or a.created_via<>'agent' or (a.approval_state<>'changes_requested' and not(orch.id is not null and orch.revision_cycles>0 and a.approval_state='draft')) or a.publication_state<>'unpublished' then
   raise exception 'Agent revision unavailable' using errcode='42501'; end if;
  if a.revision is distinct from (p_request->>'expected_asset_revision')::integer
   or c.revision is distinct from (p_request->>'expected_campaign_revision')::integer then raise exception 'Revision changed; refresh before retrying' using errcode='40001'; end if;
  select * into decision from marketing.workflow_history where workspace_id=w and asset_id=a.id and actor_type='human'
   and action='changes_requested' and (snapshot->>'revision')::integer=a.revision order by id desc limit 1;
  if (not found or length(trim(decision.notes))=0) and orch.id is null then raise exception 'Human change request required'; end if;
  select * into guardian from marketing.agent_runs r where r.workspace_id=w and r.campaign_id=c.id and r.agent_key='guardian'
   and r.status='succeeded' and r.input_metadata->'asset'->>'id'=a.id::text
   and (r.input_metadata->'asset'->>'revision')::integer between
    coalesce((select max((h.snapshot->>'revision')::integer) from marketing.workflow_history h where h.workspace_id=w and h.asset_id=a.id and h.action='asset_saved'),a.revision)
    and a.revision order by r.ended_at desc,r.id desc limit 1;
  p_request:=p_request || jsonb_build_object('asset_type',a.asset_type);
 end if;
 if agent='guardian' then
  select * into a from marketing.assets where workspace_id=w and campaign_id=c.id and id=(p_request->>'asset_id')::uuid for share;
  if not found then raise exception 'Asset unavailable' using errcode='42501'; end if;
 end if;
 context:=jsonb_build_object('request',p_request,'campaign',to_jsonb(c),'asset',case when a.id is not null then to_jsonb(a) else 'null'::jsonb end,
  'kpis',coalesce((select jsonb_agg(to_jsonb(k)) from marketing.campaign_kpis k where workspace_id=w and campaign_id=c.id),'[]'::jsonb),
  'human_change_request',case when decision.id is not null then to_jsonb(decision) else 'null'::jsonb end,
  'guardian_assessment',case when guardian.id is not null then jsonb_build_object('run_id',guardian.id,'asset_revision',guardian.input_metadata->'asset'->'revision','ended_at',guardian.ended_at,'output_metadata',guardian.output_metadata) else 'null'::jsonb end,
  'tasks',coalesce((select jsonb_agg(to_jsonb(t)) from marketing.campaign_tasks t where workspace_id=w and campaign_id=c.id),'[]'::jsonb));
 if orch.id is not null then
  context:=context||jsonb_build_object('orchestration',to_jsonb(orch),'task',(select to_jsonb(t) from marketing.campaign_tasks t where id=orch.task_id),
   'accepted_plan',(select output_metadata from marketing.agent_runs where id=orch.plan_run_id),
   'previous_guardian',(select output_metadata from marketing.agent_runs where id=any(orch.run_ids) and agent_key='guardian' and status='succeeded' order by ended_at desc limit 1));
 end if;
 if octet_length(context::text)>200000 then raise exception 'Campaign context too large'; end if;
 insert into marketing.agent_runs(id,workspace_id,campaign_id,agent_key,purpose,status,initiated_by,instruction_version,provider,model,input_metadata)
 values(p_id,w,c.id,agent,p_request->>'purpose','started',p_human,p_version,'openai',p_model,context);
 return context;
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
      or exists(select 1 from jsonb_object_keys(p_output) k where k not in ('summary','recommendation','findings')) then raise exception 'Invalid Guardian output'; end if;
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


create or replace function public.read_marketing_attention_workspace(p_workspace uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; w uuid;
begin
 result:=public.read_marketing_workspace(p_workspace);
 w:=(result->'workspace'->>'id')::uuid;
 return result || jsonb_build_object(
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


-- Human workflow evidence advances only the matching submitted revision.
create function marketing.observe_orchestration_review() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.actor_type='human' and new.action in ('submitted','approved','changes_requested') then
  update marketing.task_orchestrations set state=case new.action when 'submitted' then 'awaiting_approval' when 'approved' then 'completed' else 'changes_needed' end,
   asset_revision=(new.snapshot->>'revision')::integer,revision=revision+1,updated_at=now(),last_actor_user_id=new.actor_user_id,
   completed_at=case when new.action='approved' then now() else null end
  where workspace_id=new.workspace_id and asset_id=new.asset_id and asset_revision=(new.snapshot->>'revision')::integer-1
   and ((new.action='submitted' and state in ('awaiting_review','changes_needed')) or (new.action in ('approved','changes_requested') and state='awaiting_approval'));
 end if;
 return new;
end $$;
revoke all on function marketing.observe_orchestration_review() from public,anon,authenticated,service_role;
create trigger observe_orchestration_review after insert on marketing.workflow_history for each row execute function marketing.observe_orchestration_review();
commit;
