import { test, expect } from '@playwright/test';

test('human resolution controls persist decisions and hand Guardian drafts to separate approval', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/tests/marketing-ui/index.html?user=1&path=/marketing/campaigns/new');
  await page.getByLabel('Name', { exact: true }).fill('Human resolution campaign');
  await page.getByRole('button', { name: 'Save campaign', exact: true }).click();
  await page.getByLabel('Audience (comma separated)', { exact: true }).fill('Dealers');
  await page.getByRole('textbox', { name: 'Channels (comma separated)', exact: true }).fill('social');
  await page.getByLabel('Primary CTA', { exact: true }).fill('Book a demo');
  await page.getByRole('button', { name: 'Save brief', exact: true }).click();
  let campaignPath;
  for (const [purpose, action, outcome] of [['Accept proposal', 'Accept plan', 'Accepted'], ['Selected proposal', 'Create selected tasks', 'Tasks created: 1'], ['Dismiss proposal', 'Dismiss / no action', 'Dismissed']]) {
    await page.getByLabel('Purpose / authorized instruction').fill(purpose);
    await page.getByRole('button', { name: 'Ask Strategist', exact: true }).click();
    const summary = page.locator('summary').filter({ hasText: `strategist · succeeded · ${purpose}` });
    await expect(summary).toContainText('Review recommended'); await summary.click();
    const record = summary.locator('..');
    campaignPath = await record.getByText('Campaign:', { exact: false }).getByRole('link').getAttribute('href');
    if (action === 'Create selected tasks') {
      await expect(record.getByRole('button', { name: action, exact: true })).toBeDisabled();
      await record.getByRole('checkbox', { name: 'Prepare demo copy', exact: true }).check();
    }
    await record.getByLabel('Optional human note').fill('Reviewed deliberately.');
    await record.getByRole('button', { name: action, exact: true }).click();
    await expect(record.getByRole('status')).toContainText(outcome);
    await expect(summary).toContainText('Clear');
  }
  await page.goto(`/tests/marketing-ui/index.html?user=3&path=${encodeURIComponent(campaignPath)}`);
  const accepted = page.locator('summary').filter({ hasText: 'strategist · succeeded · Accept proposal' }); await accepted.click();
  await expect(accepted.locator('..')).toContainText('Accepted');
  await expect(page.getByRole('button', { name: 'Accept plan', exact: true })).toHaveCount(0);
  await page.goto(`/tests/marketing-ui/index.html?user=1&path=${encodeURIComponent(campaignPath)}`);
  await page.getByLabel('Agent action').selectOption('creator');
  await page.getByLabel('Purpose / authorized instruction').fill('Save revision for Guardian');
  await page.getByRole('button', { name: 'Create draft with Creator', exact: true }).click();
  const creator = page.locator('summary').filter({ hasText: 'creator · succeeded · Save revision' }); await creator.click();
  const assetPath = await creator.locator('..').getByText('Outcome asset:').getByRole('link').getAttribute('href');
  await page.getByLabel('Agent action').selectOption('guardian');
  await page.getByLabel('Asset to review').selectOption({ label: 'Creator browser draft · revision 1' });
  await page.getByLabel('Purpose / authorized instruction').fill('Ready for approval');
  await page.getByRole('button', { name: 'Run Guardian QA', exact: true }).click();
  const guardian = page.locator('summary').filter({ hasText: 'guardian · succeeded · Ready for approval' });
  await expect(guardian).toContainText('Review recommended'); await guardian.click();
  await guardian.locator('..').getByRole('button', { name: 'Send to Approval', exact: true }).click();
  await expect(guardian.locator('..').getByRole('status')).toContainText('Sent to Approval');
  await expect(guardian).toContainText('Clear');
  await expect(page.locator('summary').filter({ hasText: 'Creator browser draft · social copy · in review' })).toContainText('Human action required');
  await expect(page.getByRole('button', { name: 'Record human decision' })).toHaveCount(0);
  await page.goto(`/tests/marketing-ui/index.html?user=2&path=${encodeURIComponent(assetPath)}`);
  await page.getByRole('button', { name: 'Record human decision', exact: true }).click();
  await expect(page.locator('summary').filter({ hasText: 'Creator browser draft · social copy · approved' })).toContainText('Clear');
  expect(errors).toEqual([]);
});
