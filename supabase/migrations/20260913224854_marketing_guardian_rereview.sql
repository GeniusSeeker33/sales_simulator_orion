begin;
-- Generalize PR #34 eligibility only. Its lock, authorization, transition, run
-- creation and replay engine remain the sole Guardian-only execution pathway.
create or replace function marketing.guardian_retry_context(p_id uuid,p_human uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o marketing.task_orchestrations; r marketing.agent_runs; a marketing.assets; t marketing.campaign_tasks; c marketing.campaigns; sets jsonb; issue text; ids jsonb; rereview boolean; creator marketing.agent_runs; qa jsonb;
begin
 select * into o from marketing.task_orchestrations where id=p_id;
 select * into r from marketing.agent_runs where id=o.active_run_id;
 rereview:=r.status='succeeded' and r.agent_key='guardian' and r.output_metadata->'result'->>'recommendation'='needs_changes' and o.state in ('changes_needed','blocked');
 select * into creator from marketing.agent_runs ar where ar.id=any(o.run_ids) and ar.agent_key='creator' order by array_position(o.run_ids,ar.id) desc limit 1;
 qa:=r.output_metadata->'deterministic_qa';
 select * into a from marketing.assets where id=o.asset_id and workspace_id=o.workspace_id and campaign_id=o.campaign_id;
 select * into t from marketing.campaign_tasks where id=o.task_id;
 select * into c from marketing.campaigns where id=o.campaign_id;
 sets:=marketing.effective_constraint_sets(o.workspace_id,o.campaign_id,a.id,o.id);
 select coalesce(jsonb_agg(s->'id' order by s->>'id'),'[]') into ids from jsonb_array_elements(sets) s;
 if not exists(select 1 from marketing.workspace_members where workspace_id=o.workspace_id and user_id=p_human and role in ('contributor','approver','admin')) then issue:='You need workspace write permission to retry Guardian.';
 elsif not coalesce(rereview,false) and (o.state not in ('failed','blocked') or r.agent_key is distinct from 'guardian' or r.status is distinct from 'failed') then issue:='This work has no completed Guardian review eligible for retry.';
 elsif r.workspace_id<>o.workspace_id or r.campaign_id<>o.campaign_id or not(r.id=any(o.run_ids)) or r.input_metadata->'orchestration'->>'id' is distinct from o.id::text then issue:='The review cannot be linked safely to this work. Inspect the technical history.';
 elsif t.revision is distinct from o.task_revision or t.revision is distinct from (r.input_metadata->'task'->>'revision')::integer or t.status not in ('todo','in_progress') then issue:='The task changed. Refresh and review its scope before continuing.';
 elsif c.revision is distinct from o.campaign_revision or c.revision is distinct from (r.input_metadata->'campaign'->>'revision')::integer then issue:='The campaign changed. Refresh and review its brief before continuing.';
 elsif a.id is null or a.id is distinct from (r.input_metadata->'asset'->>'id')::uuid or a.revision is distinct from o.asset_revision or a.revision is distinct from (r.input_metadata->'asset'->>'revision')::integer or a.approval_state<>'draft' or a.publication_state<>'unpublished' then issue:='The asset changed. Refresh and review the current content before continuing.';
 elsif rereview and (creator.id is null or creator.status<>'succeeded' or creator.outcome_asset_id is distinct from a.id or array_position(o.run_ids,creator.id)>array_position(o.run_ids,r.id)) then issue:='Completed Creator evidence is required before Guardian re-review.';
 elsif rereview and (case when jsonb_typeof(qa)='array' then jsonb_array_length(qa)=0 else true end) then issue:='Confirmed deterministic checks are required before Guardian re-review.';
 elsif rereview and exists(select 1 from unnest(array['content_present','supported_asset_type','audience_defined','channel_defined','no_placeholders']) required(rule)
  where not exists(select 1 from jsonb_array_elements(qa) q where q->>'rule'=required.rule)) then issue:='Confirmed deterministic checks are required before Guardian re-review.';
 elsif rereview and exists(select 1 from jsonb_array_elements(qa) q where jsonb_typeof(q->'passed') is distinct from 'boolean') then issue:='Confirmed deterministic checks are required before Guardian re-review.';
 elsif rereview and exists(select 1 from jsonb_array_elements(qa) q where q->'passed'='false'::jsonb) then issue:='Current content has a Marketing Policy issue. Review it before continuing.';
 elsif sets is distinct from coalesce(r.input_metadata->'human_constraint_sets','[]') then issue:='Marketing Policy changed. Refresh and review the current rules before continuing.';
 elsif exists(select 1 from jsonb_array_elements(marketing.evaluate_human_constraints(a.content,sets)) q where q->>'passed'='false') then issue:='Current content has a Marketing Policy issue. Review it before continuing.';
 elsif exists(select 1 from marketing.agent_runs ar where ar.id=any(o.run_ids) and ar.status='started') then issue:='A stage is still active or uncertain. Inspect it before retrying.';
 elsif exists(select 1 from marketing.task_orchestrations other where other.id<>o.id and (other.asset_id=a.id or other.task_id=o.task_id and other.state not in ('completed','failed','blocked','cancelled'))) then issue:='Another workflow owns this work. Inspect it before continuing.';
 end if;
 return jsonb_build_object('eligible',issue is null,'kind',case when rereview then 'rereview' else 'retry' end,'reason',issue,'orchestration_id',o.id,'expected_revision',o.revision,'asset_revision',a.revision,'task_revision',t.revision,'campaign_revision',c.revision,'constraint_set_ids',ids);
end $$;

-- The immutable authorization plus predecessor identifies the human re-review
-- event without rewriting earlier runs or adding a duplicate event/status table.
alter function marketing.guardian_run_evidence(uuid) rename to guardian_run_evidence_before_rereview;
create function marketing.guardian_run_evidence(p_run uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select marketing.guardian_run_evidence_before_rereview(p_run)||jsonb_build_object('retry_authorization',(
  select jsonb_build_object('id',h.id,'event',case when prior.status='succeeded' and prior.output_metadata->'result'->>'recommendation'='needs_changes'
    then 'guardian_rereview_requested' else 'guardian_retry_requested' end,
   'actor_user_id',h.actor_user_id,'occurred_at',h.occurred_at,'prior_run_id',h.prior_run_id,'new_run_id',h.new_run_id,
   'asset_revision',h.asset_revision,'revision_cycles',prior.input_metadata->'orchestration'->'revision_cycles',
   'task_revision',prior.input_metadata->'task'->'revision','campaign_revision',prior.input_metadata->'campaign'->'revision',
   'policy_versions',coalesce((select jsonb_agg(s->'id' order by s->>'id') from jsonb_array_elements(h.policy_snapshot) s),'[]'))
  from marketing.guardian_retry_authorizations h join marketing.agent_runs prior on prior.id=h.prior_run_id where h.new_run_id=p_run))
$$;
alter function marketing.guided_work_context(uuid,uuid) rename to guided_work_context_before_rereview;
create function marketing.guided_work_context(p_id uuid,p_human uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; o marketing.task_orchestrations;
begin
 result:=marketing.guided_work_context_before_rereview(p_id,p_human);
 select * into o from marketing.task_orchestrations where id=p_id;
 if (result->'guardian_retry'->>'eligible')::boolean and result->'guardian_retry'->>'kind'='rereview' then
  result:=jsonb_set(result,'{actions}',coalesce(result->'actions','[]')||'["retry_guardian"]'::jsonb);
 elsif o.state='guardian_running' and result->'guardian'->'retry_authorization'->>'id' is not null then
  result:=result||jsonb_build_object('actions',(result->'actions')-'request_changes'-'revise'-'retry_guardian',
   'reason','Guardian is reviewing the same draft again. The content has not changed.');
 end if;
 return result;
end $$;
revoke all on function marketing.guardian_retry_context(uuid,uuid),marketing.guardian_run_evidence_before_rereview(uuid),marketing.guardian_run_evidence(uuid),
 marketing.guided_work_context_before_rereview(uuid,uuid),marketing.guided_work_context(uuid,uuid) from public,anon,authenticated,service_role;
commit;
