begin;

-- PR #31 renamed the current finish implementation to *_before_recovery on
-- staging. PR #32 wraps that implementation and expects the pre-recovery
-- implementation to remain available as *_before_constraints. Recreate that
-- lower layer only when it is missing so the guided-policy migration can be
-- applied consistently to existing staging databases and fresh environments.
do $migration$
declare
  definition text;
begin
  if to_regprocedure('marketing.finish_marketing_agent_run_before_constraints(uuid,jsonb,jsonb,jsonb,text)') is null then
    definition := pg_get_functiondef(
      'marketing.finish_marketing_agent_run_before_recovery(uuid,jsonb,jsonb,jsonb,text)'::regprocedure
    );

    definition := replace(
      definition,
      'FUNCTION marketing.finish_marketing_agent_run_before_recovery(',
      'FUNCTION marketing.finish_marketing_agent_run_before_constraints('
    );

    execute definition;
  end if;
end
$migration$;

commit;
