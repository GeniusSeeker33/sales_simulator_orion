begin;
-- Rejected model output is evidence, never a successful review or human decision.
alter table marketing.agent_run_diagnostics drop constraint agent_run_diagnostics_reason_check;
alter table marketing.agent_run_diagnostics add constraint agent_run_diagnostics_reason_check check(reason in (
 'guardian_output_schema_invalid','constraint_evaluation_mismatch','effective_policy_changed','asset_revision_changed',
 'campaign_revision_changed','task_revision_changed','permission_revoked','run_expired','guardian_persistence_failed',
 'guardian_model_failed','guardian_result_rejected','guardian_semantic_structured_mismatch'));
create table marketing.guardian_consistency_evidence (
 agent_run_id uuid primary key references marketing.agent_runs(id),
 workspace_id uuid not null references marketing.workspaces(id),
 validation_version text not null check(validation_version='guardian-consistency-v1'),
 original_result jsonb not null check(jsonb_typeof(original_result)='object' and octet_length(original_result::text)<=100000),
 inconsistencies jsonb not null check(jsonb_typeof(inconsistencies)='array' and jsonb_array_length(inconsistencies)>0),
 deterministic_qa jsonb not null, occurred_at timestamptz not null default now()
);
alter table marketing.guardian_consistency_evidence enable row level security;
revoke all on marketing.guardian_consistency_evidence from public,anon,authenticated,service_role;
create index guardian_consistency_workspace on marketing.guardian_consistency_evidence(workspace_id);
create trigger immutable_guardian_consistency before update or delete on marketing.guardian_consistency_evidence
 for each row execute function marketing.prevent_audit_mutation();

alter function public.finish_marketing_agent_run(uuid,jsonb,jsonb,jsonb,text) rename to finish_marketing_agent_run_before_consistency;
alter function public.finish_marketing_agent_run_before_consistency(uuid,jsonb,jsonb,jsonb,text) set schema marketing;
create function public.finish_marketing_agent_run(p_id uuid,p_output jsonb,p_qa jsonb,p_usage jsonb,p_error text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r marketing.agent_runs; result jsonb; reason text;
begin
 if p_error is distinct from 'guardian_semantic_structured_mismatch' then
  return marketing.finish_marketing_agent_run_before_consistency(p_id,p_output,p_qa,p_usage,p_error);
 end if;
 select * into r from marketing.agent_runs where id=p_id for update;
 if not found or r.agent_key<>'guardian' then raise exception 'Guardian run required'; end if;
 if r.status<>'started' then return to_jsonb(r); end if;
 -- This envelope is produced only by the trusted server after strict contract validation.
 if p_output->>'validation_version' is distinct from 'guardian-consistency-v1'
  or jsonb_typeof(p_output->'result') is distinct from 'object'
  or octet_length(p_output::text)>1000000
  or jsonb_typeof(p_output->'inconsistencies') is distinct from 'array'
  or jsonb_array_length(p_output->'inconsistencies') not between 1 and 2000
  or exists(select 1 from jsonb_object_keys(p_output) k where k not in ('result','inconsistencies','validation_version'))
  then raise exception 'Invalid consistency evidence'; end if;
 reason:=marketing.guardian_failure_reason(p_id,p_output->'result',null);
 if reason='guardian_result_rejected' then reason:='guardian_semantic_structured_mismatch'; end if;
 -- Failure, evidence and audit events commit together. No asset write is attempted.
 result:=marketing.finish_marketing_agent_run_before_diagnostics(p_id,null,'[]',p_usage,'invalid_output');
 insert into marketing.agent_run_diagnostics(agent_run_id,workspace_id,reason) values(p_id,r.workspace_id,reason);
 insert into marketing.guardian_consistency_evidence(agent_run_id,workspace_id,validation_version,original_result,inconsistencies,deterministic_qa)
 values(p_id,r.workspace_id,p_output->>'validation_version',p_output->'result',p_output->'inconsistencies',p_qa);
 return result;
end $$;

alter function marketing.guardian_run_evidence(uuid) rename to guardian_run_evidence_before_consistency;
create function marketing.guardian_run_evidence(p_run uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select marketing.guardian_run_evidence_before_consistency(p_run)||jsonb_build_object(
  'inconsistencies',coalesce((select e.inconsistencies from marketing.guardian_consistency_evidence e where e.agent_run_id=p_run),'[]'::jsonb))
$$;
alter function marketing.guided_work_context(uuid,uuid) rename to guided_work_context_before_consistency;
create function marketing.guided_work_context(p_id uuid,p_human uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 result:=marketing.guided_work_context_before_consistency(p_id,p_human);
 if result->'guardian'->>'technical_reason'='guardian_semantic_structured_mismatch'
  and (result->'guardian_retry'->>'eligible')::boolean then
  result:=result||jsonb_build_object('reason','Automated checks passed. Guardian returned conflicting review evidence, so the content has not been sent back for revision. Retry the review without changing the content.');
 end if;
 return result;
end $$;
-- A contradictory review is never authority for another Creator cycle, even via
-- a handcrafted request to the trusted API instead of the Guided Work buttons.
alter function public.command_marketing_orchestration(uuid,jsonb) rename to command_marketing_orchestration_before_consistency;
alter function public.command_marketing_orchestration_before_consistency(uuid,jsonb) set schema marketing;
create function public.command_marketing_orchestration(p_human uuid,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_request->>'action' in ('revise','review') and not exists(select 1 from marketing.workspace_members
  where workspace_id=(p_request->>'workspace_id')::uuid and user_id=p_human and role in ('contributor','approver','admin')) then
  raise exception 'Workspace write permission required' using errcode='42501';
 end if;
 if p_request->>'action' in ('revise','review') and exists(
  select 1 from marketing.task_orchestrations o join marketing.agent_run_diagnostics d on d.agent_run_id=o.active_run_id
  where o.id=(p_request->>'id')::uuid and o.workspace_id=(p_request->>'workspace_id')::uuid
   and d.reason='guardian_semantic_structured_mismatch' and o.state in ('failed','blocked')) then
  raise exception 'Guardian must be retried before a content decision' using errcode='40001';
 end if;
 return marketing.command_marketing_orchestration_before_consistency(p_human,p_request);
end $$;
revoke all on function marketing.command_marketing_orchestration_before_consistency(uuid,jsonb),public.command_marketing_orchestration(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.command_marketing_orchestration(uuid,jsonb) to service_role;

-- Preserve the existing membership check and deduplicated read model; expose only a safe reason.
alter function public.read_marketing_attention_workspace(uuid) rename to read_marketing_attention_workspace_before_consistency;
alter function public.read_marketing_attention_workspace_before_consistency(uuid) set schema marketing;
create function public.read_marketing_attention_workspace(p_workspace uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=marketing.read_marketing_attention_workspace_before_consistency(p_workspace);
 return jsonb_set(result,'{attention_runs}',coalesce((select jsonb_agg(r||jsonb_build_object('review_issue',exists(
  select 1 from marketing.agent_run_diagnostics d where d.agent_run_id=(r->>'id')::uuid
   and d.workspace_id=(result->'workspace'->>'id')::uuid and d.reason='guardian_semantic_structured_mismatch')))
  from jsonb_array_elements(result->'attention_runs') r),'[]'));
end $$;
revoke all on function marketing.finish_marketing_agent_run_before_consistency(uuid,jsonb,jsonb,jsonb,text),public.finish_marketing_agent_run(uuid,jsonb,jsonb,jsonb,text),
 marketing.guardian_run_evidence_before_consistency(uuid),marketing.guardian_run_evidence(uuid),marketing.guided_work_context_before_consistency(uuid,uuid),marketing.guided_work_context(uuid,uuid),
 marketing.read_marketing_attention_workspace_before_consistency(uuid),public.read_marketing_attention_workspace(uuid) from public,anon,authenticated,service_role;
grant execute on function public.finish_marketing_agent_run(uuid,jsonb,jsonb,jsonb,text) to service_role;
grant execute on function public.read_marketing_attention_workspace(uuid) to authenticated;
commit;
