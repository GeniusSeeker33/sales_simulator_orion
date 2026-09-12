-- Repository-only migration. No publishing endpoints or agent orchestration.
begin;

alter table marketing.campaigns
 add column offer text not null default '' check(length(offer)<=4000),
 add column primary_cta text not null default '' check(length(primary_cta)<=1000),
 add column key_message text not null default '' check(length(key_message)<=4000),
 add column requirements text not null default '' check(length(requirements)<=8000),
 add column notes text not null default '' check(length(notes)<=8000);
alter table marketing.campaign_tasks
 add column created_by uuid references auth.users(id),
 add column updated_by uuid references auth.users(id),
 add column updated_at timestamptz not null default now(),
 add column revision integer not null default 1 check(revision>0);
-- Legacy tasks have no recorded creator: preserve that uncertainty.
alter table marketing.assets
 add column content text not null default '' check(length(content)<=50000),
 add column updated_by uuid references auth.users(id),
 add column updated_at timestamptz not null default now(),
 add column revision integer not null default 1 check(revision>0);

create table marketing.workflow_history (
 id bigint generated always as identity primary key,
 workspace_id uuid not null, campaign_id uuid not null,
 task_id uuid references marketing.campaign_tasks(id), asset_id uuid references marketing.assets(id),
 action text not null check(action in ('brief_saved','task_saved','asset_saved','submitted','approved','changes_requested')),
 actor_type text not null check(actor_type in ('human','agent')),
 actor_user_id uuid not null references auth.users(id), agent_run_id uuid references marketing.agent_runs(id),
 notes text not null default '' check(length(notes)<=8000),
 snapshot jsonb not null, occurred_at timestamptz not null default now(),
 foreign key(workspace_id,campaign_id) references marketing.campaigns(workspace_id,id),
 check ((actor_type='agent')=(agent_run_id is not null)),
 check (action not in ('approved','changes_requested') or actor_type='human')
);
alter table marketing.workflow_history enable row level security;
revoke all on marketing.workflow_history from public,anon,authenticated;
grant select on marketing.workflow_history to authenticated;
create policy workflow_member_read on marketing.workflow_history for select to authenticated
 using(marketing.has_membership(workspace_id));
-- RLS evaluates this caller-scoped helper as the reader, so it needs EXECUTE.
grant execute on function marketing.has_membership(uuid,text[]) to authenticated;
create trigger immutable_workflow_history before update or delete on marketing.workflow_history
 for each row execute function marketing.prevent_audit_mutation();
create index marketing_workflow_campaign on marketing.workflow_history(workspace_id,campaign_id,id desc);
create index marketing_assets_review on marketing.assets(workspace_id,approval_state,created_at);
create index marketing_tasks_campaign on marketing.campaign_tasks(workspace_id,campaign_id);

-- Validate narrow payloads and membership inside the privileged boundary.
create function marketing.check_workflow_write(p_workspace uuid,p_campaign uuid,p_payload jsonb,p_allowed text[])
returns void language plpgsql security definer set search_path='' as $$
begin
 if not marketing.has_membership(p_workspace,array['contributor','approver','admin']) then
  raise exception 'Marketing write access unavailable' using errcode='42501';
 end if;
 if not exists(select 1 from marketing.campaigns where workspace_id=p_workspace and id=p_campaign) then
  raise exception 'Campaign unavailable' using errcode='42501';
 end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid workflow payload'; end if;
 if exists(select 1 from jsonb_object_keys(p_payload) k where not(k=any(p_allowed))) then
  raise exception 'Unexpected workflow field';
 end if;
end $$;

create function public.save_marketing_brief(p_workspace uuid,p_campaign uuid,p_expected_revision integer,p_payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare c marketing.campaigns; metrics jsonb;
begin
 perform marketing.check_workflow_write(p_workspace,p_campaign,p_payload,
  array['objectives','target_audiences','channels','offer','primary_cta','key_message','requirements','notes','kpis']);
 select * into c from marketing.campaigns where workspace_id=p_workspace and id=p_campaign for update;
 if p_expected_revision is null or c.revision<>p_expected_revision then raise exception 'Campaign changed; refresh before retrying'; end if;
 if c.status='active' then raise exception 'Pause the campaign before revising its brief'; end if;
 metrics:=coalesce(p_payload->'kpis','[]'::jsonb);
 if jsonb_typeof(metrics)<>'array' or jsonb_array_length(metrics)>30 then raise exception 'Invalid success metrics'; end if;
 if exists(select 1 from jsonb_array_elements(metrics) k where jsonb_typeof(k)<>'object'
  or length(trim(coalesce(k->>'name',''))) not between 1 and 160
  or length(coalesce(k->>'unit','count'))>80) then raise exception 'Invalid success metrics'; end if;
 update marketing.campaigns set objectives=array(select jsonb_array_elements_text(p_payload->'objectives')),
  target_audiences=array(select jsonb_array_elements_text(p_payload->'target_audiences')),
  channels=array(select jsonb_array_elements_text(p_payload->'channels')),
  offer=coalesce(p_payload->>'offer',''),primary_cta=coalesce(p_payload->>'primary_cta',''),
  key_message=coalesce(p_payload->>'key_message',''),requirements=coalesce(p_payload->>'requirements',''),notes=coalesce(p_payload->>'notes',''),
  approval_state='draft',updated_by=auth.uid(),updated_at=now(),revision=revision+1 where id=p_campaign;
 delete from marketing.campaign_kpis where workspace_id=p_workspace and campaign_id=p_campaign;
 insert into marketing.campaign_kpis(workspace_id,campaign_id,name,target_value,unit)
 select p_workspace,p_campaign,k->>'name',nullif(k->>'target_value','')::numeric,coalesce(nullif(k->>'unit',''),'count') from jsonb_array_elements(metrics) k;
 insert into marketing.campaign_transitions(workspace_id,campaign_id,from_status,to_status,from_approval_state,to_approval_state,actor_type,actor_user_id,reason)
 values(p_workspace,p_campaign,c.status,c.status,c.approval_state,'draft','human',auth.uid(),'Brief revised; approval reset');
 insert into marketing.workflow_history(workspace_id,campaign_id,action,actor_type,actor_user_id,snapshot)
 values(p_workspace,p_campaign,'brief_saved','human',auth.uid(),p_payload);
end $$;

create function public.save_marketing_task(p_workspace uuid,p_campaign uuid,p_id uuid,p_expected_revision integer,p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare old marketing.campaign_tasks; saved marketing.campaign_tasks; owner_id uuid;
begin
 perform marketing.check_workflow_write(p_workspace,p_campaign,p_payload,array['title','status','owner_user_id','due_on']);
 if p_id is null or length(trim(coalesce(p_payload->>'title',''))) not between 1 and 240 then raise exception 'Task title required (maximum 240 characters)'; end if;
 owner_id:=nullif(p_payload->>'owner_user_id','')::uuid;
 if owner_id is not null and not exists(select 1 from marketing.workspace_members where workspace_id=p_workspace and user_id=owner_id) then
  raise exception 'Task owner must belong to the workspace';
 end if;
 select * into old from marketing.campaign_tasks where workspace_id=p_workspace and campaign_id=p_campaign and id=p_id for update;
 if found then
  if p_expected_revision is null or old.revision<>p_expected_revision then raise exception 'Task changed; refresh before retrying'; end if;
  update marketing.campaign_tasks set title=trim(p_payload->>'title'),status=coalesce(p_payload->>'status','todo'),
   owner_user_id=owner_id,due_on=nullif(p_payload->>'due_on','')::date,updated_by=auth.uid(),updated_at=now(),revision=revision+1
   where id=p_id returning * into saved;
 else
  if p_expected_revision is not null then raise exception 'Task unavailable'; end if;
  insert into marketing.campaign_tasks(id,workspace_id,campaign_id,title,status,owner_user_id,due_on,created_by,updated_by)
  values(p_id,p_workspace,p_campaign,trim(p_payload->>'title'),coalesce(p_payload->>'status','todo'),owner_id,nullif(p_payload->>'due_on','')::date,auth.uid(),auth.uid()) returning * into saved;
 end if;
 insert into marketing.workflow_history(workspace_id,campaign_id,task_id,action,actor_type,actor_user_id,snapshot)
 values(p_workspace,p_campaign,p_id,'task_saved','human',auth.uid(),to_jsonb(saved));
 return p_id;
end $$;

-- Agent mode is private and has no browser grant. No new orchestrator is introduced.
create function marketing.write_asset_internal(p_workspace uuid,p_campaign uuid,p_id uuid,p_expected_revision integer,
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
   if old.approval_state<>'in_review' then raise exception 'Asset must be in review'; end if;
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

create function public.write_marketing_asset(p_workspace uuid,p_campaign uuid,p_id uuid,p_expected_revision integer,p_action text,p_payload jsonb)
returns uuid language sql security definer set search_path='' as $$
 select marketing.write_asset_internal(p_workspace,p_campaign,p_id,p_expected_revision,p_action,p_payload,'human',null)
$$;
create function marketing.write_asset_as_agent(p_workspace uuid,p_campaign uuid,p_id uuid,p_expected_revision integer,p_action text,p_payload jsonb,p_agent_run uuid)
returns uuid language sql security definer set search_path='' as $$
 select marketing.write_asset_internal(p_workspace,p_campaign,p_id,p_expected_revision,p_action,p_payload,'agent',p_agent_run)
$$;

-- Keep the existing workspace selection and membership boundary.
create or replace function public.read_marketing_workspace(p_workspace uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w marketing.workspaces;
begin
 select x.* into w from marketing.workspaces x join marketing.workspace_members m on m.workspace_id=x.id
 where m.user_id=auth.uid() and (p_workspace is null or x.id=p_workspace) order by x.is_default desc,x.created_at limit 1;
 if not found then raise exception 'Marketing workspace unavailable' using errcode='42501'; end if;
 return jsonb_build_object('workspace',to_jsonb(w),'role',(select role from marketing.workspace_members where workspace_id=w.id and user_id=auth.uid()),
 'campaigns',coalesce((select jsonb_agg(to_jsonb(c) order by updated_at desc) from marketing.campaigns c where workspace_id=w.id),'[]'::jsonb),
 'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',user_id,'role',role) order by user_id) from marketing.workspace_members where workspace_id=w.id),'[]'::jsonb),
 'kpis',coalesce((select jsonb_agg(to_jsonb(k) order by created_at,id) from marketing.campaign_kpis k where workspace_id=w.id),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(to_jsonb(t) order by due_on nulls last,created_at,id) from marketing.campaign_tasks t where workspace_id=w.id),'[]'::jsonb),
 'assets',coalesce((select jsonb_agg(to_jsonb(a) order by updated_at desc,id) from marketing.assets a where workspace_id=w.id),'[]'::jsonb));
end $$;

-- Fetch potentially long review snapshots only when an asset is opened.
create function public.read_marketing_asset_history(p_workspace uuid,p_asset uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not marketing.has_membership(p_workspace) or not exists(select 1 from marketing.assets where workspace_id=p_workspace and id=p_asset) then
  raise exception 'Asset unavailable' using errcode='42501';
 end if;
 return coalesce((select jsonb_agg(to_jsonb(h) order by id desc) from marketing.workflow_history h where workspace_id=p_workspace and asset_id=p_asset),'[]'::jsonb);
end $$;

revoke all on function marketing.check_workflow_write(uuid,uuid,jsonb,text[]),
 marketing.write_asset_internal(uuid,uuid,uuid,integer,text,jsonb,text,uuid),
 marketing.write_asset_as_agent(uuid,uuid,uuid,integer,text,jsonb,uuid),
 public.save_marketing_brief(uuid,uuid,integer,jsonb),public.save_marketing_task(uuid,uuid,uuid,integer,jsonb),
 public.write_marketing_asset(uuid,uuid,uuid,integer,text,jsonb),public.read_marketing_asset_history(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.save_marketing_brief(uuid,uuid,integer,jsonb),public.save_marketing_task(uuid,uuid,uuid,integer,jsonb),
 public.write_marketing_asset(uuid,uuid,uuid,integer,text,jsonb),public.read_marketing_asset_history(uuid,uuid) to authenticated;
commit;
