begin;
-- Historical evidence is immutable; current policy evaluation governs unchanged content.
create or replace function marketing.evaluate_human_constraints_before_policy(p_content text,p_sets jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb:='[]'; c jsonb; normalized text:=marketing.normalize_constraint_text(p_content);
 term text; matched text; position integer; failed boolean; semantic boolean; detail text; tokens text[]; host text; destination_found boolean;
begin
 for c in select v from jsonb_array_elements(p_sets) s cross join lateral jsonb_array_elements(s->'constraints') v loop
  failed:=false; semantic:=false; matched:=null; position:=null;
  term:=marketing.normalize_constraint_text(c->>'value');
  if c->>'constraint_type' in ('prohibited_phrase','prohibited_claim','required_phrase_or_concept') then
   position:=strpos(' '||normalized||' ',' '||term||' ');
   if c->>'constraint_type'='required_phrase_or_concept' then
    if c->'details'->>'mode'='concept' then semantic:=position=0; else failed:=position=0; end if;
    detail:='Required phrase/concept: '||(c->>'value');
   else
    failed:=position>0; semantic:=not failed and c->>'constraint_type'='prohibited_claim';
    detail:='Prohibited phrase/claim: '||(c->>'value');
   end if;
   if position>0 then matched:=term; end if;
  elsif c->>'constraint_type'='required_destination' then
   host:=regexp_replace(lower(c->>'value'),'^www\.',''); destination_found:=false;
   -- Same bounded hostname extraction as Guardian QA v2: whole host, no credential URLs.
   for tokens in select regexp_matches(lower(p_content),'(?:https?://|www\.)[^\s<>()[\]"'']+|\m[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}(?:/[^\s<>()[\]"'']*)?','g') loop
    term:=regexp_replace(tokens[1],'[.,;:!?]+$','');
    if strpos(term,'@')>0 then continue; end if;
    term:=regexp_replace(term,'^https?://',''); term:=split_part(split_part(split_part(split_part(term,'/',1),'?',1),'#',1),':',1);
    term:=regexp_replace(regexp_replace(term,'^www\.',''),'\.$','');
    if term=host then destination_found:=true; end if;
   end loop;
   failed:=not destination_found; detail:='Required destination hostname: '||host;
  else
   tokens:=case c->>'constraint_type'
    when 'no_unverified_comparative_claim' then array['competitive','best','leading','leader','superior']
    when 'no_unverified_outcome_claim' then array['grow your business','success','increase sales','improve profit','outperform','win']
    else array['testimonial','testimonials','customer says','dealer says','satisfied dealer'] end;
   foreach term in array tokens loop
    -- Mask only the conventional courtesy phrase, preserving normalized offsets.
    position:=strpos(' '||(case when c->>'constraint_type'='no_unverified_comparative_claim' then regexp_replace(normalized,'\mbest regards\M','kind regards','g') else normalized end)||' ',' '||term||' ');
    if position>0 then failed:=true; matched:=term; exit; end if;
   end loop;
   if c->>'constraint_type'='no_fabricated_testimonial' and not failed then
    failed:=p_content ~* '["“][^"”]{3,250}["”][[:space:]]*[-—][^\n]{0,100}(dealer|customer)';
    if failed then matched:='Quoted dealer/customer endorsement'; end if;
   end if;
   semantic:=not failed;
   detail:=case c->>'constraint_type' when 'no_fabricated_testimonial' then 'No fabricated testimonials (no approved testimonial evidence is linked)'
    when 'no_unverified_comparative_claim' then 'No unverified comparative claims' else 'No unverified business-outcome claims' end;
  end if;
  result:=result||jsonb_build_array(jsonb_build_object('rule','human_constraint:'||(c->>'id'),'constraint_id',c->>'id',
   'constraint_type',c->>'constraint_type','passed',not failed,'review_required',semantic,
   'detail',detail,'matched_text',matched,'normalized_offset',case when position>0 then position else null end,
   'excerpt',case when position>0 then substring(normalized from greatest(1,position-40) for 160) else null end,
   'qa_version','human-constraints-v1'));
 end loop;
 return result;
end $$;

create or replace function marketing.guardian_retry_context(p_id uuid,p_human uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o marketing.task_orchestrations; r marketing.agent_runs; a marketing.assets; t marketing.campaign_tasks; c marketing.campaigns; sets jsonb; issue text; ids jsonb; rereview boolean; creator marketing.agent_runs; qa jsonb; current_checks jsonb;
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
 current_checks:=marketing.evaluate_human_constraints(a.content,sets);
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
 elsif rereview and exists(select 1 from jsonb_array_elements(qa) q where q->'passed'='false'::jsonb
  and not exists(select 1 from jsonb_array_elements(current_checks) fresh where fresh->>'constraint_id'=q->>'constraint_id' and fresh->>'rule'=q->>'rule' and fresh->'passed'='true'::jsonb)) then issue:='Current content has a Marketing Policy issue. Review it before continuing.';
 elsif sets is distinct from coalesce(r.input_metadata->'human_constraint_sets','[]') then issue:='Marketing Policy changed. Refresh and review the current rules before continuing.';
 elsif exists(select 1 from jsonb_array_elements(current_checks) q where q->>'passed'='false') then issue:='Current content has a Marketing Policy issue. Review it before continuing.';
 elsif exists(select 1 from marketing.agent_runs ar where ar.id=any(o.run_ids) and ar.status='started') then issue:='A stage is still active or uncertain. Inspect it before retrying.';
 elsif exists(select 1 from marketing.task_orchestrations other where other.id<>o.id and (other.asset_id=a.id or other.task_id=o.task_id and other.state not in ('completed','failed','blocked','cancelled'))) then issue:='Another workflow owns this work. Inspect it before continuing.';
 end if;
 return jsonb_build_object('eligible',issue is null,'kind',case when rereview then 'rereview' else 'retry' end,'reason',issue,'orchestration_id',o.id,'expected_revision',o.revision,'asset_revision',a.revision,'task_revision',t.revision,'campaign_revision',c.revision,'constraint_set_ids',ids);
end $$;


revoke all on function marketing.evaluate_human_constraints_before_policy(text,jsonb),marketing.guardian_retry_context(uuid,uuid) from public,anon,authenticated,service_role;
commit;
