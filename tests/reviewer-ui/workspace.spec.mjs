import { test, expect } from '@playwright/test';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test.beforeEach(async({page})=>{await page.goto('/tests/reviewer-ui/index.html');await expect(page.getByLabel('Assigned learner / episode')).toBeEnabled();});
async function choose(page,n=1){await page.getByLabel('Assigned learner / episode').selectOption(id(100+n));await expect(page.locator('.review-actions').getByRole('button',{name:'Review Competency',exact:true})).toBeEnabled();}
test('selected learner, distinct actions, collapsed technical/history, keyboard and mobile layout',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await choose(page);
 await expect(page.locator('.review-learner h2')).toHaveText('Learner 1 · Episode 1');
 await expect(page.locator('.review-level strong')).toHaveText('L1');
 await expect(page.locator('.review-actions button')).toHaveCount(4);
 await page.screenshot({path:'test-results/reviewer-desktop.png',fullPage:true});
 await expect(page.locator('.review-technical[open]')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Older Practice'})).not.toBeVisible();
 await page.locator('.review-actions button').first().focus();await page.keyboard.press('Enter');
 await expect(page.locator('#review-coaching form')).toBeVisible();
 await expect(page.locator('#review-coaching form input').first()).toBeFocused();
 await page.screenshot({path:'test-results/reviewer-form.png',fullPage:true});
 await page.locator('#review-coaching form').getByRole('button',{name:'Cancel',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
 await page.screenshot({path:'test-results/reviewer-mobile.png',fullPage:true});
 expect(errors).toEqual([]);
});
test('episode switch destroys drafts and hides old results during delayed requests',async({page})=>{
 await choose(page);await page.locator('.review-actions').getByRole('button',{name:'Record Coaching',exact:true}).click();
 await page.locator('#review-coaching form textarea').first().fill('Previous learner draft');
 await page.evaluate(()=>{window.reviewFixture.delay=700;});
 await page.getByLabel('Assigned learner / episode').selectOption(id(102));
 await expect(page.locator('.review-learner h2')).toHaveText('Learner 2 · Episode 1');
 await expect(page.getByText('Previous learner draft')).toHaveCount(0);
 await expect(page.locator('#review-practice')).not.toBeVisible();
 await expect(page.locator('#review-practice h3').first()).toHaveText('Expert Buyer');
 await expect(page.locator('#review-coaching')).toHaveCount(1);
 await expect(page.locator('#review-coaching form')).toHaveCount(0);
});
test('auth switch clears scope and all old episode state, even while requests finish',async({page})=>{
 await choose(page);await page.evaluate(()=>{window.reviewFixture.delay=400;window.reviewFixture.setUser('00000000-0000-4000-8000-000000000002');});
 await expect(page.getByLabel('Assigned learner / episode')).toHaveValue('');
 await expect(page.locator('.review-learner')).toHaveCount(0);
 await expect(page.locator('#review-coaching')).toHaveCount(0);
 await expect(page.getByLabel('Assigned learner / episode').locator('option')).toHaveCount(2);
});
test('band evidence selection publishes exact reference and explicit decision',async({page})=>{
 await choose(page);await page.locator('.review-actions').getByRole('button',{name:'Review Competency',exact:true}).click();
 const form=page.locator('#review-bands form');
 await expect(form.locator('.review-evidence-option')).toHaveCount(1);
 await form.locator('.review-evidence-option input').check();
 await expect(form.getByLabel('Explicit human outcome')).toHaveValue('');
 await form.getByLabel('Explicit human outcome').selectOption('B2');
 await form.getByLabel('Required rationale (visible to learner)',{exact:false}).fill('Reviewed the current evidence against the anchor.');
 await form.getByRole('button',{name:'Publish human review',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.reviewFixture.packets.length)).toBe(1);
 const packet=await page.evaluate(()=>window.reviewFixture.packets[0]);
 expect(packet.name).toBe('publish_competency_band_review');expect(packet.args.p_scope).toBe(id(101));
 expect(packet.args.p_body.evidence).toEqual([{id:id(601),revision:1}]);expect(packet.args.p_body.outcome).toBe('B2');
});

test('practice selector retains exact kind/id/revision for competency evidence',async({page})=>{
 await choose(page);await page.locator('.review-actions').getByRole('button',{name:'Record Competency Evidence',exact:true}).click();
 const form=page.locator('#review-evidence form');
 await expect(form.locator('.review-evidence-option')).toHaveCount(3);
 await form.locator('.review-evidence-option input').first().check();
 await form.getByLabel('Observed behavior summary',{exact:false}).fill('Clarified the buying concern.');
 await form.getByLabel('Evidence date (UTC calendar date)',{exact:false}).fill('2026-09-06');
 await form.getByRole('button',{name:'Publish human finding',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.reviewFixture.packets.length)).toBe(1);
 const packet=await page.evaluate(()=>window.reviewFixture.packets[0]);
 expect(packet.args.p_body.evidence).toEqual({kind:'attempt',id:id(501),revision:2});
 expect(packet.args.p_scope).toBe(id(101));
});
test('progression selector preserves band references and explicit remain outcome',async({page})=>{
 await choose(page);await page.locator('.review-actions').getByRole('button',{name:'Review Progression',exact:true}).click();
 const form=page.locator('#review-progression form');
 await form.locator('.review-evidence-option input').first().check();
 await expect(form.getByLabel('Explicit human outcome')).toHaveValue('');
 await form.getByLabel('Explicit human outcome').selectOption('remain_L1');
 await form.getByLabel('Required rationale',{exact:false}).fill('Remain while development continues.');
 await form.getByLabel('Development priorities / next-step plan',{exact:false}).fill('Practice the next-step recap.');
 await form.getByRole('button',{name:'Publish human progression decision',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.reviewFixture.packets.length)).toBe(1);
 const packet=await page.evaluate(()=>window.reviewFixture.packets[0]);
 expect(packet.args.p_body.bands).toEqual([{id:id(801),revision:1}]);
 expect(packet.args.p_body.expected_history_id).toBe(id(901));
 expect(packet.args.p_body.outcome).toBe('remain_L1');
});
test('same-episode access refresh preserves an unfinished form',async({page})=>{
 await choose(page);await page.locator('.review-actions').getByRole('button',{name:'Record Coaching',exact:true}).click();
 await page.locator('#review-coaching form textarea').first().fill('Keep this draft during an access check.');
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.locator('#review-coaching form textarea').first()).toHaveValue('Keep this draft during an access check.');
 await expect(page.locator('#review-coaching form')).toBeVisible();
});

test('My Coaching has styled learner actions and preserves acknowledgment payload',async({page})=>{
 await page.goto('/tests/reviewer-ui/index.html?learner');
 const workspace=page.locator('.my-coaching-workspace');
 await expect(workspace.getByRole('heading',{name:'Your coaching & next steps'})).toBeVisible();
 await expect(workspace.locator('.review-level strong')).toHaveText('L1');
 await expect(workspace.locator('[data-create]')).toHaveCount(0);
 await expect(workspace.locator('.review-technical[open]')).toHaveCount(0);
 await workspace.getByRole('button',{name:'Acknowledge / comment'}).click();
 const form=workspace.locator('#review-coaching form');
 await expect(form.getByRole('checkbox')).toBeFocused();
 await form.getByRole('checkbox').check();
 await form.getByLabel('Optional learner comment').fill('I will practice the recap before our follow-up.');
 await page.screenshot({path:'test-results/my-coaching-desktop.png',fullPage:true});
 await form.getByRole('button',{name:'Save learner response'}).click();
 await expect.poll(()=>page.evaluate(()=>window.reviewFixture.packets.length)).toBe(1);
 const packet=await page.evaluate(()=>window.reviewFixture.packets[0]);
 expect(packet.name).toBe('respond_to_coaching');
 expect(packet.args).toMatchObject({p_session:id(701),p_ack:true,p_comment:'I will practice the recap before our follow-up.'});
 expect(Object.keys(packet.args).sort()).toEqual(['p_ack','p_comment','p_id','p_session']);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
});
test('My Coaching clears prior learner comments when auth changes',async({page})=>{
 await page.goto('/tests/reviewer-ui/index.html?learner');
 const comment=page.getByLabel('Optional learner comment');await comment.fill('Old learner draft');
 await page.evaluate(()=>window.reviewFixture.setUser('00000000-0000-4000-8000-000000000002'));
 await expect(comment).toHaveValue('');
 await expect(page.locator('#review-coaching')).toHaveCount(1);
 await expect(page.locator('.my-coaching-workspace')).toHaveCount(1);
});
