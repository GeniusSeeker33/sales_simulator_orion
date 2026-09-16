import test from 'node:test';
import assert from 'node:assert/strict';
import { readIntakeReview } from '../api/_lib/intake-review.js';
import { readFile } from 'node:fs/promises';

const workspace = '00000000-0000-4000-8000-000000000010';
const human = '00000000-0000-4000-8000-000000000001';
const emptySource = { read: async () => ({ contract_version: 1, applications: [], activities: [], documents: [], consents: [] }) };
function queryFor(role, seen = []) {
  return async (sql, params, phase) => {
    seen.push({ sql, params, phase });
    if (sql.includes('workspace_members')) return role ? [{ id: workspace, slug: 'orion', name: 'Orion', role }] : [];
    if (sql.includes('join_orion_source_exclusions')) return [];
    if (sql.includes('from crm.workspaces')) return [{ id: workspace, slug: 'orion', name: 'Orion' }];
    if (sql.includes('from crm.people') || sql.includes('from crm.applications') || sql.includes('from crm.activities') || sql.includes('from crm.documents') || sql.includes('from crm.consent_records')) return [];
    throw new Error(`Unexpected query: ${sql}`);
  };
}

test('only manager and admin workspace members can read intake', async () => {
  for (const role of [null, 'viewer', 'contributor']) assert.equal((await readIntakeReview(queryFor(role), human, workspace, emptySource)).status, 403);
  for (const role of ['manager', 'admin']) assert.equal((await readIntakeReview(queryFor(role), human, workspace, emptySource)).status, 200);
});

test('workspace identity scopes every CRM/exclusion query and response is read-only', async () => {
  const seen = [];
  const result = await readIntakeReview(queryFor('manager', seen), human, workspace, emptySource);
  assert.equal(result.body.approval_boundary, 'read_only');
  assert.ok(seen.every(call => call.params.includes(workspace)));
  assert.equal(seen.some(call => /^\s*(insert|update|delete)/i.test(call.sql)), false);
});

test('durable exclusion migration is RLS protected and contains governance fields only', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260916120000_join_orion_intake_exclusions.sql', import.meta.url), 'utf8');
  for (const field of ['application_source_id', 'classification', 'reason', 'reviewed_by', 'reviewed_at']) assert.match(sql, new RegExp(field));
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /array\['manager','admin'\]/);
  assert.doesNotMatch(sql, /resume_path|cover_letter|admin_notes|referral_payout|database_url/i);
});
