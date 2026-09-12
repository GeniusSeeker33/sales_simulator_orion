begin;
-- Human acknowledgments are separate from immutable model evidence.
create table marketing.agent_run_resolutions (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 campaign_id uuid not null,
 agent_run_id uuid not null unique references marketing.agent_runs(id),
 actor_user_id uuid not null references auth.users(id),
 action text not null check(action in ('accept_plan','create_tasks','dismiss','send_to_approval')),
 note text check(length(note)<=4000),
 created_task_ids uuid[] not null default '{}',
 occurred_at timestamptz not null default now(),
 foreign key(workspace_id,campaign_id) references marketing.campaigns(workspace_id,id)
);
alter table marketing.agent_run_resolutions enable row level security;
revoke all on marketing.agent_run_resolutions from public,anon,authenticated,service_role;
create trigger immutable_resolution before update or delete on marketing.agent_run_resolutions
 for each row execute function marketing.prevent_audit_mutation();
create index agent_run_resolutions_workspace on marketing.agent_run_resolutions(workspace_id);

create function public.resolve_marketing_agent_run(p_workspace uuid,p_run uuid,p_action text,p_selection jsonb default '[]',p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r marketing.agent_runs; a marketing.assets; resolution marketing.agent_run_resolutions;
 selected jsonb; proposed jsonb; task_id uuid; task_ids uuid[]:='{}'; task_index integer;
begin
 -- Derive identity only from the authenticated human; lock membership against revocation.
 perform 1 from marketing.workspace_members where workspace_id=p_workspace and user_id=auth.uid()
  and role in ('contributor','approver','admin') for share;
 if not found then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 select * into r from marketing.agent_runs where workspace_id=p_workspace and id=p_run for update;
 if not found or r.status<>'succeeded' then raise exception 'Successful run unavailable'; end if;
 if exists(select 1 from marketing.agent_run_resolutions where agent_run_id=r.id) then raise exception 'Run already resolved'; end if;
 if p_action is null or p_action not in ('accept_plan','create_tasks','dismiss','send_to_approval')
  or jsonb_typeof(p_selection) is distinct from 'array' or length(coalesce(p_note,''))>4000 then raise exception 'Invalid resolution'; end if;
 if p_action<>'create_tasks' and jsonb_array_length(p_selection)<>0 then raise exception 'Unexpected task selection'; end if;
 if r.agent_key='strategist' and p_action in ('accept_plan','create_tasks','dismiss') then
  if p_action='create_tasks' then
   proposed:=r.output_metadata->'result'->'proposed_tasks';
   if jsonb_typeof(proposed) is distinct from 'array' or jsonb_array_length(p_selection) not between 1 and 20
    or (select count(distinct value) from jsonb_array_elements(p_selection))<>jsonb_array_length(p_selection) then raise exception 'Invalid task selection'; end if;
   for selected in select value from jsonb_array_elements(p_selection) loop
    if jsonb_typeof(selected)<>'number' or selected::text !~ '^(0|[1-9][0-9]{0,2})$' then raise exception 'Invalid task index'; end if;
    task_index:=selected::text::integer;
    if task_index>=jsonb_array_length(proposed) or jsonb_typeof(proposed->task_index) is distinct from 'string'
     or length(trim(proposed->>task_index)) not between 1 and 240 then raise exception 'Invalid persisted task'; end if;
    task_id:=gen_random_uuid();
    perform public.save_marketing_task(p_workspace,r.campaign_id,task_id,null,jsonb_build_object('title',proposed->>task_index,'status','todo'));
    task_ids:=array_append(task_ids,task_id);
   end loop;
  end if;
 elsif r.agent_key='guardian' and p_action='send_to_approval' then
  if r.output_metadata->'result'->>'recommendation' is distinct from 'ready_for_human_review'
   or exists(select 1 from jsonb_array_elements(coalesce(r.output_metadata->'deterministic_qa','[]')) q where q->>'passed'='false') then raise exception 'Guardian is not ready for human review'; end if;
  -- Use the assessed revision, never a browser-supplied replacement revision.
  select * into a from marketing.assets where workspace_id=p_workspace and campaign_id=r.campaign_id
   and id=(r.input_metadata->'asset'->>'id')::uuid for update;
  if not found or a.revision is distinct from (r.input_metadata->'asset'->>'revision')::integer
   or a.approval_state<>'draft' or a.publication_state<>'unpublished' then raise exception 'Asset changed or already submitted; refresh'; end if;
  perform public.write_marketing_asset(p_workspace,r.campaign_id,a.id,a.revision,'submit',jsonb_build_object('notes',coalesce(p_note,'')));
 else raise exception 'Action is not allowed for this agent'; end if;
 insert into marketing.agent_run_resolutions(workspace_id,campaign_id,agent_run_id,actor_user_id,action,note,created_task_ids)
 values(p_workspace,r.campaign_id,r.id,auth.uid(),p_action,nullif(trim(p_note),''),task_ids) returning * into resolution;
 return to_jsonb(resolution);
end $$;
revoke all on function public.resolve_marketing_agent_run(uuid,uuid,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.resolve_marketing_agent_run(uuid,uuid,text,jsonb,text) to authenticated;

create or replace function public.read_marketing_attention_workspace(p_workspace uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; w uuid;
begin
 result:=public.read_marketing_workspace(p_workspace);
 w:=(result->'workspace'->>'id')::uuid;
 return result || jsonb_build_object(
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

commit;
