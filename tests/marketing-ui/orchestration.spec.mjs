import { test, expect } from '@playwright/test';
const open = (page, user, path) => page.goto(`/tests/marketing-ui/index.html?user=${user}&path=${encodeURIComponent(path)}`);
test('guided plan, inline human approval and separate task completion', async ({ page }) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page,2,'/marketing/campaigns/new');
  await page.getByLabel('Name',{exact:true}).fill('Guided browser campaign');await page.getByRole('button',{name:'Save campaign',exact:true}).click();
  await page.getByLabel('Audience (comma separated)',{exact:true}).fill('Dealers');await page.getByRole('textbox',{name:'Channels (comma separated)',exact:true}).fill('social');await page.getByLabel('Primary CTA',{exact:true}).fill('Book a demo');await page.getByRole('button',{name:'Save brief',exact:true}).click();
  await page.getByText('Add task',{exact:true}).click();await page.getByLabel('Task title',{exact:true}).fill('Guided dealer copy');await page.getByRole('button',{name:'Create task',exact:true}).click();
  const summary=page.locator('summary').filter({hasText:'Guided dealer copy · todo'});await summary.click();const task=summary.locator('..');await task.getByText('Guided Work',{exact:true}).click();
  await task.getByLabel('Execution workflow').selectOption('strategist_creator_guardian');await task.getByRole('button',{name:'Assign to Agent Team',exact:true}).click();
  const card=task.locator('.marketing-guided-work');await expect(card.getByRole('button',{name:'Accept Plan',exact:true})).toBeVisible();await card.getByRole('button',{name:'View proposed plan'}).click();await expect(card.getByText(/Proposed demo execution plan/).first()).toBeVisible();await card.getByRole('button',{name:'Accept Plan',exact:true}).click();
  await expect(card.getByRole('button',{name:'Approve',exact:true})).toBeVisible();await expect(card.getByRole('list',{name:'Guided workflow pipeline'})).toContainText('REVIEW');await card.screenshot({path:'test-results/marketing-ui/guided-review.png'});
  await expect(card.getByRole('button',{name:'Send to Approval',exact:true})).toHaveCount(0);await expect(card.getByRole('button',{name:'Mark Task Complete',exact:true})).toHaveCount(0);
  const path=await card.getByRole('link',{name:/Guided Work/}).getAttribute('href');expect(path).toMatch(/task=.*&work=/);
  await open(page,3,path);await expect(page.getByRole('button',{name:'Approve',exact:true})).toHaveCount(0);await expect(page.locator('.marketing-guided-work').first()).toBeVisible();
  await open(page,2,path);const guided=page.locator('.marketing-guided-work').first();await guided.getByRole('button',{name:'Approve',exact:true}).click();await expect(guided.getByText(/Step 5 of 5: Agent work complete/)).toBeVisible();await expect(summary).toContainText('todo');await guided.getByRole('button',{name:'Mark Task Complete',exact:true}).click();await expect(page.locator('summary').filter({hasText:'Guided dealer copy · done'})).toBeVisible();
  expect(errors).toEqual([]);
});
