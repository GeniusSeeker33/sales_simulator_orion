import { test, expect } from '@playwright/test';

const workspace = 'w';
const stamp = () => new Date().toISOString();
function dataFixture() {
  const task = (id, status = 'todo') => ({ id, workspace_id: workspace, campaign_id: 'c', revision: 1, title: id, status });
  const run = (id, agent, assetRevision = 1) => ({ id, workspace_id: workspace, campaign_id: 'c', agent_key: agent, status: 'succeeded', purpose: id, started_at: stamp(), ended_at: stamp(), asset_id: 'a', asset_revision: assetRevision, recommendation: 'ready_for_human_review', output_metadata: { result: { summary: 'Historical evidence' } }, input_metadata: {}, usage: { total_tokens: 140 } });
  const orchestration = (id, state, runIds = []) => ({ id, workspace_id: workspace, campaign_id: 'c', task_id: id, task_revision: 1, campaign_revision: 1, revision: 2, revision_cycles: 1, workflow: 'creator_guardian', state, run_ids: runIds, updated_at: stamp() });
  return { workspace: { id: workspace, name: 'Synthetic UX workspace' }, role: 'contributor', campaigns: [{ id: 'c', workspace_id: workspace, revision: 1, name: 'Dealer campaign' }], members: [], kpis: [], tasks: [task('Constrained copy'), task('Approval copy'), task('Working copy'), task('Finished copy', 'done')], assets: [{ id: 'a', workspace_id: workspace, campaign_id: 'c', name: 'Dealer draft', revision: 2, approval_state: 'draft', created_via: 'agent', content: 'Competitive wholesale firearms.' }, { id: 'review', workspace_id: workspace, campaign_id: 'c', name: 'Approval draft', revision: 3, approval_state: 'in_review', created_via: 'agent' }], attention_events: [], resolutions: [], human_constraint_sets: [], orchestration_history: [], asset_constraint_checks: [{ asset_id: 'a', revision: 2, checks: [{ constraint_id: 'phrase', constraint_type: 'prohibited_phrase', passed: false, matched_text: 'competitive wholesale firearms' }, { constraint_id: 'comparative', constraint_type: 'no_unverified_comparative_claim', passed: false, matched_text: 'competitive' }] }], attention_runs: [run('old creator', 'creator'), run('old guardian', 'guardian'), run('new creator', 'creator', 2)], orchestrations: [{ ...orchestration('Constrained copy', 'changes_needed', ['old creator', 'old guardian', 'new creator']), asset_id: 'a', asset_revision: 2, active_run_id: 'new creator', reason: 'Human constraint failed' }, { ...orchestration('Approval copy', 'awaiting_approval'), asset_id: 'review', asset_revision: 3 }, orchestration('Working copy', 'creator_running'), orchestration('Finished copy', 'completed')] };
}

test('command center matches badge, groups current work, explains constraint failures and preserves filtered history', async ({ page }) => {
  const d = dataFixture();
  await page.route('**/__marketing_rpc', async route => {
    const { name, args } = route.request().postDataJSON();
    const result = name === 'read_marketing_attention_workspace' ? d : name === 'read_marketing_agent_runs' ? d.attention_runs : name === 'read_marketing_agent_run' ? d.attention_runs.find(r => r.id === args.p_run) : null;
    await route.fulfill({ json: { data: result, error: null } });
  });
  await page.goto('/tests/marketing-ui/index.html?user=1&path=/marketing/agents');
  const needs = page.getByRole('region', { name: 'Needs You (2)' });
  await expect(needs.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Agents', exact: true })).toHaveAccessibleDescription('2 unresolved items: Human action required');
  await expect(page.getByRole('region', { name: 'Working', exact: true }).getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Recently Completed' }).getByRole('article')).toHaveCount(1);
  await expect(page.locator('summary').filter({ hasText: 'creator · succeeded' })).toHaveCount(0);
  const failure = needs.getByRole('article', { name: 'Constrained copy: Human constraint failed' });
  await expect(failure.getByText('Human action required', { exact: false })).toBeVisible();
  await expect(failure.getByText('Prohibited phrase: “competitive wholesale firearms”', { exact: true })).toBeVisible();
  await expect(failure.getByText('Comparative claim detected: “competitive”', { exact: true })).toBeVisible();
  await expect(failure.getByRole('list', { name: 'Workflow pipeline' }).locator('li').filter({ hasText: 'Guardian' })).toContainText('Not reached');
  await failure.getByRole('button', { name: 'Review Constraint Failure', exact: true }).click();
  await expect(failure.getByRole('button', { name: 'Send failures to Creator' })).toBeVisible();
  await expect(failure.getByRole('button', { name: 'Stop workflow' })).toBeVisible();
  await expect(failure.getByRole('link', { name: /Review asset manually/ })).toHaveAttribute('href', '/marketing/campaigns/c?asset=a&revision=2');
  await expect(needs.getByRole('link', { name: 'Approve / Request Changes' })).toHaveAttribute('href', '/marketing/campaigns/c?asset=review&revision=3');
  await page.screenshot({ path: 'test-results/marketing-ui/command-center-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({ path: 'test-results/marketing-ui/command-center-mobile.png', fullPage: true });
  // A human decision plus task completion removes its card after authoritative refresh.
  d.assets[1].approval_state = 'approved'; d.orchestrations[1].state = 'completed'; d.tasks[1].status = 'done';
  await page.getByRole('button', { name: 'Refresh work', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Needs You (1)' }).getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Agents', exact: true })).toHaveAccessibleDescription('1 unresolved items: Human action required');
  await page.getByRole('link', { name: 'Run History', exact: true }).click();
  await expect(page.locator('summary').filter({ hasText: 'creator · succeeded' })).toHaveCount(2);
  await page.getByLabel('Filter campaign').selectOption('c');
  await page.getByLabel('Filter task').selectOption('Constrained copy');
  await page.getByLabel('Filter agent').selectOption('guardian');
  await page.getByLabel('Filter status').selectOption('succeeded');
  await expect(page.locator('summary').filter({ hasText: 'guardian · succeeded' })).toHaveCount(1);
  await expect(page.locator('summary').filter({ hasText: 'creator · succeeded' })).toHaveCount(0);
  await page.locator('summary').filter({ hasText: 'guardian · succeeded' }).click();
  await expect(page.getByText(/Tokens: input/)).toBeVisible();
  await expect(page.getByText(/Run old guardian/)).toBeVisible();
});
