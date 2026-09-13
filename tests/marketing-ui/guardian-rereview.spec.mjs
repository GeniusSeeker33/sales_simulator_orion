import { test, expect } from '@playwright/test';
const read=async page=>(await(await page.request.post('/__marketing_rpc',{headers:{'x-test-user':'2'},data:{name:'read_marketing_attention_workspace',args:{p_workspace:null}}})).json()).data;
const open=(page,path)=>page.goto(`/tests/marketing-ui/index.html?user=2&path=${encodeURIComponent(path)}`);

test('human can re-review unchanged revision 3 at cycle 1/3, see another recommendation and then approve',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page,'/marketing/campaigns/new');await page.getByLabel('Name',{exact:true}).fill('Guardian re-review campaign');await page.getByRole('button',{name:'Save campaign',exact:true}).click();
  await page.getByLabel('Audience (comma separated)',{exact:true}).fill('Dealers');await page.getByRole('textbox',{name:'Channels (comma separated)',exact:true}).fill('email');await page.getByLabel('Primary CTA',{exact:true}).fill('Book a demo');await page.getByRole('button',{name:'Save brief',exact:true}).click();
  await page.getByText('Add task',{exact:true}).click();await page.getByLabel('Task title',{exact:true}).fill('Re-review dealer email');await page.getByRole('button',{name:'Create task',exact:true}).click();
  const task=page.locator('summary').filter({hasText:'Re-review dealer email · todo'});await task.click();const form=task.locator('..');await form.getByText('Guided Work',{exact:true}).click();
  await form.getByLabel('Execution workflow').selectOption('creator_guardian');await form.getByLabel('Agent team instructions / revision notes').fill('Human Guardian re-review');await form.getByRole('button',{name:'Assign to Agent Team',exact:true}).click();
  const initial=form.locator('.marketing-guided-work');await initial.getByRole('button',{name:'Request Changes & Send for Revision',exact:true}).click();await initial.getByLabel('What needs to change?').fill('Clarify the verified benefit.');await initial.getByRole('button',{name:'Request Changes & Send for Revision',exact:true}).click();
  await expect(initial.getByRole('button',{name:'Retry Guardian review',exact:true})).toBeVisible();
  const before=await read(page);const o=before.orchestrations.find(o=>o.task_id===before.tasks.find(t=>t.title==='Re-review dealer email').id);const asset=before.assets.find(a=>a.id===o.asset_id);
  expect(o.revision_cycles).toBe(1);expect(asset.revision).toBe(3);
  await open(page,'/marketing/agents');const needs=page.getByRole('region',{name:/^Needs You/});const card=needs.locator('.marketing-guided-work').filter({hasText:'Re-review dealer email'});
  await expect(card).toHaveCount(1);await expect(card.getByRole('button',{name:'Request Changes & Send for Revision',exact:true})).toHaveClass('btn-primary');
  await expect(card.getByRole('button',{name:'Retry Guardian review',exact:true})).toHaveClass('btn-secondary');
  await expect(card.getByRole('button',{name:'Retry Guardian review',exact:true})).toHaveAccessibleDescription('Run Guardian again on this same draft without changing the content or using a revision cycle.');
  const count=await needs.getByRole('article').count();await expect(page.getByRole('link',{name:'Agents',exact:true})).toHaveAccessibleDescription(`${count} unresolved items: Human action required`);
  let release;const held=new Promise(resolve=>{release=resolve;});let intercepted=false;const requests=[];
  await page.route('**/api/marketing-orchestration',async route=>{
    const body=route.request().postDataJSON();requests.push(body);
    if(body.action==='retry_guardian'&&!intercepted){intercepted=true;const response=await route.fetch();await held;await route.fulfill({response});}
    else await route.continue();
  });
  await card.getByRole('button',{name:'Retry Guardian review',exact:true}).click();
  try {
    await expect(card.getByRole('list',{name:'Guided workflow pipeline'}).locator('li').filter({hasText:'CHECK'})).toContainText('Completed');
    await expect(card.getByRole('list',{name:'Guided workflow pipeline'}).locator('li').filter({hasText:'REVIEW'})).toContainText('Guardian reviewing again');
    await expect(card).toContainText('The content has not changed.');await expect(card).toContainText('Revision cycles: 1/3');
    await expect(card.getByRole('button',{name:/Request Changes|Send.*Revision|Retry Guardian/})).toHaveCount(0);await expect(card).toHaveCount(1);
    await card.screenshot({path:'test-results/marketing-ui/guardian-reviewing-again.png'});
  } finally {release();}
  await expect(card.getByRole('region',{name:'Guardian recommends changes'})).toContainText('Second assessment: clarify the verified dealer benefit.');
  await expect(card.getByRole('button',{name:'Request Changes & Send for Revision',exact:true})).toBeVisible();await expect(card.getByRole('button',{name:'Retry Guardian review',exact:true})).toBeVisible();
  let data=await read(page);let current=data.orchestrations.find(r=>r.id===o.id);expect(current.run_ids).toHaveLength(o.run_ids.length+1);expect(current.revision_cycles).toBe(1);expect(data.assets.find(a=>a.id===asset.id)).toEqual(asset);
  const duplicate=await page.request.post('/api/marketing-orchestration',{headers:{Authorization:'Bearer 2'},data:requests[0]});expect((await duplicate.json()).orchestration.run_ids).toEqual(current.run_ids);
  await card.getByText('Advanced technical history',{exact:true}).click();const evidence=card.getByRole('region',{name:'Guardian retry authorization'});
  await expect(evidence).toContainText('guardian_rereview_requested');await expect(evidence).toContainText('Same asset revision: 3');await expect(evidence).toContainText('Revision cycles: 1/3');await expect(card.getByRole('link',{name:o.active_run_id,exact:true})).toBeVisible();await card.getByText('Advanced technical history',{exact:true}).click();
  await card.getByRole('button',{name:'Retry Guardian review',exact:true}).click();await expect(card.getByRole('button',{name:'Approve',exact:true})).toBeVisible();await expect(card.getByRole('button',{name:'Request Changes',exact:true})).toBeVisible();await expect(card.getByRole('button',{name:'Retry Guardian review',exact:true})).toHaveCount(0);
  data=await read(page);current=data.orchestrations.find(r=>r.id===o.id);expect(current.run_ids).toHaveLength(o.run_ids.length+2);expect(current.revision_cycles).toBe(1);expect(data.assets.find(a=>a.id===asset.id)).toEqual(asset);
  expect(data.attention_runs.filter(r=>r.agent_key==='creator'&&current.run_ids.includes(r.id))).toHaveLength(2);
  const prior=(await(await page.request.post('/__marketing_rpc',{headers:{'x-test-user':'2'},data:{name:'read_marketing_agent_run',args:{p_workspace:data.workspace.id,p_run:o.active_run_id}}})).json()).data;
  expect(prior.output_metadata.result.findings[0].finding).toBe('Clarify the dealer benefit.');
  await card.getByRole('button',{name:'Approve',exact:true}).click();await card.getByRole('button',{name:'Mark Task Complete',exact:true}).click();await expect(card).toHaveCount(0);expect(errors).toEqual([]);
});
