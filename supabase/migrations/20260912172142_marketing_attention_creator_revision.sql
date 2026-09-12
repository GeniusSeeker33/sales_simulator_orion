-- Repository-only. Derive attention from evidence; no duplicate status columns.
begin;
create or replace function public.start_marketing_agent_run(p_id uuid,p_human uuid,p_request jsonb,p_version text,p_model text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare w uuid:=(p_request->>'workspace_id')::uuid; c marketing.campaigns; a marketing.assets; context jsonb; agent text:=p_request->>'agent_key'; decision marketing.workflow_history; guardian marketing.agent_runs;
begin
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
  if not found or a.created_via<>'agent' or a.approval_state<>'changes_requested' or a.publication_state<>'unpublished' then
   raise exception 'Agent revision unavailable' using errcode='42501'; end if;
  if a.revision is distinct from (p_request->>'expected_asset_revision')::integer
   or c.revision is distinct from (p_request->>'expected_campaign_revision')::integer then raise exception 'Revision changed; refresh before retrying' using errcode='40001'; end if;
  select * into decision from marketing.workflow_history where workspace_id=w and asset_id=a.id and actor_type='human'
   and action='changes_requested' and (snapshot->>'revision')::integer=a.revision order by id desc limit 1;
  if not found or length(trim(decision.notes))=0 then raise exception 'Human change request required'; end if;
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
      or a.created_via<>'agent' or a.approval_state<>'changes_requested' or a.publication_state<>'unpublished'
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


-- One coherent workspace snapshot, including compact attention evidence for ALL runs.
-- The 50-run activity feed is deliberately not the source of attention counts.
create function public.read_marketing_attention_workspace(p_workspace uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; w uuid;
begin
 result:=public.read_marketing_workspace(p_workspace);
 w:=(result->'workspace'->>'id')::uuid;
 return result || jsonb_build_object(
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

-- A specific old run can be opened directly, even after it leaves the recent feed.
create function public.read_marketing_agent_run(p_workspace uuid,p_run uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not marketing.has_membership(p_workspace) then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 select to_jsonb(r) into result from marketing.agent_runs r where workspace_id=p_workspace and id=p_run;
 if result is null then raise exception 'Run unavailable' using errcode='42501'; end if;
 return result;
end $$;
revoke all on function public.read_marketing_attention_workspace(uuid),public.read_marketing_agent_run(uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_marketing_attention_workspace(uuid),public.read_marketing_agent_run(uuid,uuid) to authenticated;
-- CREATE OR REPLACE preserves service-only grants on start/finish. No private write grants change.
commit;
