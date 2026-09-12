-- Repository-only: no hosted migration or deployment.
begin;
alter table marketing.agent_runs
 add column instruction_version text,
 add column provider text,
 add column model text,
 add column input_metadata jsonb not null default '{}',
 add column output_metadata jsonb not null default '{}',
 add column usage jsonb not null default '{}',
 add column cost_usd numeric check(cost_usd>=0),
 add column error_code text,
 add column outcome_asset_id uuid references marketing.assets(id);
alter table marketing.assets add column agent_run_id uuid references marketing.agent_runs(id);
create index marketing_runs_recent on marketing.agent_runs(workspace_id,started_at desc,id);
create table marketing.agent_run_history (
 id bigint generated always as identity primary key,
 workspace_id uuid not null references marketing.workspaces(id),
 agent_run_id uuid not null references marketing.agent_runs(id),
 snapshot jsonb not null, occurred_at timestamptz not null default now()
);
alter table marketing.agent_run_history enable row level security;
revoke all on marketing.agent_run_history from public,anon,authenticated;
grant select on marketing.agent_run_history to authenticated;
create policy run_history_member on marketing.agent_run_history for select to authenticated using(marketing.has_membership(workspace_id));
create index marketing_run_history_run on marketing.agent_run_history(workspace_id,agent_run_id,id);
create trigger immutable_agent_history before update or delete on marketing.agent_run_history for each row execute function marketing.prevent_audit_mutation();

create function marketing.audit_agent_run() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='DELETE' then raise exception 'Agent runs are immutable'; end if;
 if TG_OP='UPDATE' and (old.status<>'started' or new.status='started'
  or (to_jsonb(new)-array['status','ended_at','output_metadata','usage','cost_usd','error_code','outcome_asset_id'])
    is distinct from (to_jsonb(old)-array['status','ended_at','output_metadata','usage','cost_usd','error_code','outcome_asset_id']))
 then raise exception 'Agent run identity and terminal results are immutable'; end if;
 if new.instruction_version is not null and ((new.status='started' and new.ended_at is not null) or (new.status<>'started' and new.ended_at is null)) then raise exception 'Invalid run lifecycle'; end if;
 insert into marketing.agent_run_history(workspace_id,agent_run_id,snapshot) values(new.workspace_id,new.id,to_jsonb(new));
 return new;
end $$;
-- AFTER insert so history can reference the new run; updates/deletes roll back on rejection.
create trigger audit_agent_runs after insert or update or delete on marketing.agent_runs for each row execute function marketing.audit_agent_run();
create trigger immutable_agent_run_delete before delete on marketing.agent_runs for each row execute function marketing.prevent_audit_mutation();

-- Service-only RPCs accept the verified human ID from the server, never from browser authority.
create function public.start_marketing_agent_run(p_id uuid,p_human uuid,p_request jsonb,p_version text,p_model text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare w uuid:=(p_request->>'workspace_id')::uuid; c marketing.campaigns; a marketing.assets; context jsonb; agent text:=p_request->>'agent_key';
begin
 if p_human is null or not exists(select 1 from marketing.workspace_members where workspace_id=w and user_id=p_human and role in ('contributor','approver','admin')) then
  raise exception 'Marketing write access unavailable' using errcode='42501';
 end if;
 -- Lock membership until initiation commits; completion rechecks it.
 perform 1 from marketing.workspace_members where workspace_id=w and user_id=p_human for share;
 select * into c from marketing.campaigns where workspace_id=w and id=(p_request->>'campaign_id')::uuid for share;
 if not found then raise exception 'Campaign unavailable' using errcode='42501'; end if;
 if agent is null or agent not in ('strategist','creator','guardian') or p_version<>'marketing-v1' or p_version is null
 or length(trim(coalesce(p_request->>'purpose',''))) not between 1 and 4000
 or exists(select 1 from jsonb_object_keys(p_request) k where k not in ('workspace_id','campaign_id','agent_key','purpose','asset_id','asset_type','submit_for_review'))
 then raise exception 'Invalid agent request'; end if;
 if agent='creator' and (coalesce(p_request->>'asset_type','') not in ('social_copy','email_copy','web_copy','print_copy','image_brief','video_brief')
 or jsonb_typeof(p_request->'submit_for_review') is distinct from 'boolean') then raise exception 'Invalid Creator options'; end if;
 if agent='guardian' then
  select * into a from marketing.assets where workspace_id=w and campaign_id=c.id and id=(p_request->>'asset_id')::uuid for share;
  if not found then raise exception 'Asset unavailable' using errcode='42501'; end if;
 end if;
 context:=jsonb_build_object('request',p_request,'campaign',to_jsonb(c),'asset',case when a.id is not null then to_jsonb(a) else 'null'::jsonb end,
  'kpis',coalesce((select jsonb_agg(to_jsonb(k)) from marketing.campaign_kpis k where workspace_id=w and campaign_id=c.id),'[]'::jsonb),
  'tasks',coalesce((select jsonb_agg(to_jsonb(t)) from marketing.campaign_tasks t where workspace_id=w and campaign_id=c.id),'[]'::jsonb));
 if octet_length(context::text)>200000 then raise exception 'Campaign context too large'; end if;
 insert into marketing.agent_runs(id,workspace_id,campaign_id,agent_key,purpose,status,initiated_by,instruction_version,provider,model,input_metadata)
 values(p_id,w,c.id,agent,p_request->>'purpose','started',p_human,p_version,'openai',p_model,context);
 return context;
end $$;

create function public.finish_marketing_agent_run(p_id uuid,p_output jsonb,p_qa jsonb,p_usage jsonb,p_error text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r marketing.agent_runs; c marketing.campaigns; a marketing.assets; asset_id uuid; failure text:=p_error; previous_sub text; previous_claims text;
begin
 select * into r from marketing.agent_runs where id=p_id for update;
 if not found then raise exception 'Agent run unavailable'; end if;
 if r.status<>'started' then return to_jsonb(r); end if;
 if r.instruction_version is distinct from 'marketing-v1' then raise exception 'Unsupported agent run'; end if;
 if failure is null then
  -- Subtransaction: any validation/write failure rolls back ALL result mutations.
  begin
   perform 1 from marketing.workspace_members where workspace_id=r.workspace_id and user_id=r.initiated_by and role in ('contributor','approver','admin') for share;
   if not found then raise exception 'Permission revoked'; end if;
   select * into c from marketing.campaigns where workspace_id=r.workspace_id and id=r.campaign_id for share;
   if not found or c.revision<>(r.input_metadata->'campaign'->>'revision')::integer then raise exception 'Campaign changed'; end if;
   if r.started_at < now()-interval '2 minutes' then raise exception 'Run expired'; end if;
   if p_output is null or jsonb_typeof(p_output)<>'object' or octet_length(p_output::text)>100000 then raise exception 'Invalid output'; end if;
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
    asset_id:=gen_random_uuid();
    perform marketing.write_asset_as_agent(r.workspace_id,r.campaign_id,asset_id,null,'save',p_output,r.id);
    update marketing.assets set agent_run_id=r.id where id=asset_id;
    if (r.input_metadata->'request'->>'submit_for_review')::boolean then
     perform marketing.write_asset_as_agent(r.workspace_id,r.campaign_id,asset_id,1,'submit','{}',r.id);
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

create function public.read_marketing_agent_runs(p_workspace uuid,p_campaign uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not marketing.has_membership(p_workspace) then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.started_at desc,r.id) from
  (select * from marketing.agent_runs where workspace_id=p_workspace and (p_campaign is null or campaign_id=p_campaign) order by started_at desc,id limit 50) r),'[]'::jsonb);
end $$;

revoke all on function marketing.audit_agent_run(),public.start_marketing_agent_run(uuid,uuid,jsonb,text,text),
 public.finish_marketing_agent_run(uuid,jsonb,jsonb,jsonb,text),public.read_marketing_agent_runs(uuid,uuid) from public,anon,authenticated;
grant execute on function public.start_marketing_agent_run(uuid,uuid,jsonb,text,text),
 public.finish_marketing_agent_run(uuid,jsonb,jsonb,jsonb,text) to service_role;
grant execute on function public.read_marketing_agent_runs(uuid,uuid) to authenticated;
commit;
