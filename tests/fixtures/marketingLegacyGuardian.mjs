import { readFile } from 'node:fs/promises';

// Persist historical QA through real completion functions, without editing audit rows.
export async function withLegacyConstraintEvaluator(db, complete) {
  await db.exec('reset role');
  const current = (await db.query("select pg_get_functiondef('marketing.evaluate_human_constraints_before_policy(text,jsonb)'::regprocedure) definition")).rows[0].definition;
  const migration = await readFile(new URL('../../supabase/migrations/20260912213640_marketing_human_constraints.sql', import.meta.url), 'utf8');
  const legacy = migration.slice(migration.indexOf('create function marketing.evaluate_human_constraints('), migration.indexOf('create function public.save_marketing_human_constraints('))
    .replace('create function marketing.evaluate_human_constraints(', 'create or replace function marketing.evaluate_human_constraints_before_policy(');
  await db.exec(legacy);
  try { return await complete(); }
  finally { await db.exec('reset role'); await db.exec(current); }
}
