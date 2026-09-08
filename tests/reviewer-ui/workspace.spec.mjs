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

async function coachingDraft(page) {
 await choose(page);
 await page.locator('.review-actions').getByRole('button',{name:'Record Coaching',exact:true}).click();
 const form=page.locator('#review-coaching form');
 await form.getByLabel('Occurred at', {exact:false}).fill('2026-09-06T14:00:00Z');
 await form.getByRole('checkbox', {name:/C01/}).check();
 await form.locator('.review-evidence-option input').first().check();
 for(const label of ['Observed behavior','Strengths','Development opportunity','Assigned practice / next action']) {
  await form.getByLabel(label, {exact:false}).fill(`Draft ${label}`);
 }
 await form.getByLabel('Optional follow-up date').fill('2026-09-20');
 await form.getByLabel('Development progress', {exact:false}).selectOption({index:1});
 return form;
}

test('background revalidation preserves coaching DOM, all fields, scroll, focus and evidence',async({page})=>{
 await page.clock.install();
 const form=await coachingDraft(page);
 const active=form.getByLabel('Observed behavior',{exact:false});
 await active.focus();
 await active.evaluate(el=>el.scrollIntoView({block:'center'}));
 await page.evaluate(()=>{
  const form=document.querySelector('#review-coaching form');
  window.draftProbe={node:form,y:scrollY,focus:document.activeElement,
   inputs:[...form.querySelectorAll('input,textarea,select')].map(el=>[el.value,el.checked])};
  window.reviewFixture.delay=600;
  window.reviewFixture.calls=[];
  window.unexpectedMoves=[];
  window.addEventListener('scroll',()=>{if(Math.abs(scrollY-window.draftProbe.y)>3)window.unexpectedMoves.push(scrollY);});
 });
 // Typing itself must not reload access or history.
 await active.press('End');await active.press('Space');await active.press('Backspace');
 expect(await page.evaluate(()=>window.reviewFixture.calls)).toEqual([]);
 async function unchanged() {
  await expect(form).toBeVisible();await expect(active).toBeFocused();
  await expect(page.getByLabel('Assigned learner / episode')).toHaveValue(id(101));
  expect(await page.evaluate(()=>{
   const p=window.draftProbe,form=document.querySelector('#review-coaching form');
   return {same:form===p.node,focus:document.activeElement===p.focus,delta:Math.abs(scrollY-p.y),
    values:JSON.stringify([...form.querySelectorAll('input,textarea,select')].map(el=>[el.value,el.checked]))===JSON.stringify(p.inputs),moves:window.unexpectedMoves};
  })).toEqual({same:true,focus:true,delta:0,values:true,moves:[]});
 }
 // Exercise the actual 30-second timers, including delayed in-flight state.
 await page.clock.fastForward(30000);await unchanged();
 await page.clock.runFor(700);await unchanged();
 // Window focus revalidation and asynchronous panel results must also be stable.
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await unchanged();
 await page.clock.runFor(700);await unchanged();
 const calls=await page.evaluate(()=>window.reviewFixture.calls);
 for(const rpc of ['read_reviewer_history','read_coaching_sessions','read_competency_evidence','read_competency_band_reviews','read_progression_reviews'])expect(calls).toContain(rpc);
});

test('cancel discards coaching draft and successful publication closes completed form',async({page})=>{
 let form=await coachingDraft(page);
 await form.getByRole('button',{name:'Cancel',exact:true}).click();await expect(form).toHaveCount(0);
 await page.locator('.review-actions').getByRole('button',{name:'Record Coaching',exact:true}).click();
 form=page.locator('#review-coaching form');
 await expect(form.getByLabel('Occurred at',{exact:false})).toHaveValue('');
 await expect(form.getByLabel('Observed behavior',{exact:false})).toHaveValue('');
 await expect(form.locator('input:checked')).toHaveCount(0);
 await form.getByRole('button',{name:'Cancel',exact:true}).click();
 form=await coachingDraft(page);
 await form.getByRole('button',{name:'Publish completed coaching',exact:true}).click();
 await expect(form).toHaveCount(0);
 const packet=await page.evaluate(()=>window.reviewFixture.packets[0]);
 expect(packet.name).toBe('publish_coaching_session');
 expect(packet.args.p_scope).toBe(id(101));expect(packet.args.p_body.targets).toEqual(['C01']);
 expect(packet.args.p_body.evidence).toEqual([{kind:'attempt',id:id(501),revision:2}]);
});

test('real auth change clears an open coaching draft; same-user auth event does not',async({page})=>{
 const form=await coachingDraft(page);
 await page.evaluate(()=>window.reviewFixture.setUser('00000000-0000-4000-8000-000000000001'));
 await expect(form.getByLabel('Observed behavior',{exact:false})).toHaveValue('Draft Observed behavior');
 await page.evaluate(()=>window.reviewFixture.setUser('00000000-0000-4000-8000-000000000002'));
 await expect(form).toHaveCount(0);await expect(page.getByLabel('Assigned learner / episode')).toHaveValue('');
});

test('failed access revalidation hides previously loaded workspace and draft',async({page})=>{
 const form=await coachingDraft(page);
 await page.evaluate(()=>{window.reviewFixture.deny=true;window.dispatchEvent(new Event('focus'));});
 await expect(form).not.toBeVisible();await expect(page.locator('.review-actions')).not.toBeVisible();
 await expect(page.getByRole('alert').filter({hasText:'Reviewer history unavailable or access no longer authorized.'}).first()).toBeVisible();
});

async function learnerResponse(page) {
 await page.goto('/tests/reviewer-ui/index.html?learner');
 const form=page.locator('#review-coaching form');
 await expect(form).toBeVisible();return form;
}
test('learner save has pending/success states, immediate history and duplicate-submit protection',async({page})=>{
 const form=await learnerResponse(page);
 await page.evaluate(()=>{window.reviewFixture.responseDelay=500;});
 await form.getByLabel('Optional learner comment').fill('My saved response');await form.getByRole('checkbox').check();
 await form.getByRole('button',{name:'Save learner response'}).click();
 await expect(form.getByRole('button',{name:'Saving…'})).toBeDisabled();
 await form.evaluate(el=>{el.requestSubmit();el.requestSubmit();});
 await expect(form.getByRole('status')).toHaveText('✓ Response saved');
 await expect(form.getByRole('region',{name:'Your recorded responses'}).getByText('My saved response')).toBeVisible();
 await expect(form.getByLabel('Add another comment')).toHaveValue('');
 await expect(form.getByRole('checkbox')).not.toBeChecked();await expect(form.getByRole('checkbox')).toBeDisabled();
 await expect(form.getByRole('button',{name:'Save learner response'})).toBeDisabled();
 await form.evaluate(el=>el.requestSubmit());
 expect(await page.evaluate(()=>window.reviewFixture.packets.length)).toBe(1);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(form.getByRole('status')).toHaveText('✓ Response saved');
 await form.getByLabel('Add another comment').fill('An intentional second comment');
 await form.getByRole('button',{name:'Save learner response'}).click();
 await expect(form.getByRole('status')).toHaveText('✓ Response saved');
 const packets=await page.evaluate(()=>window.reviewFixture.packets);
 expect(packets).toHaveLength(2);expect(packets[1].args.p_ack).toBe(false);expect(packets[1].args.p_id).not.toBe(packets[0].args.p_id);
});
test('rapid learner double click sends exactly one response',async({page})=>{
 const form=await learnerResponse(page);await page.evaluate(()=>{window.reviewFixture.responseDelay=500;});
 await form.getByLabel('Optional learner comment').fill('Double click test');
 const button=form.getByRole('button',{name:'Save learner response'});const box=await button.boundingBox();
 await page.mouse.dblclick(box.x+box.width/2,box.y+box.height/2);
 await expect(form.getByRole('status')).toHaveText('✓ Response saved');
 expect(await page.evaluate(()=>window.reviewFixture.packets.length)).toBe(1);
});
test('failed learner response keeps draft and retries identical packet without false success',async({page})=>{
 const form=await learnerResponse(page);await page.evaluate(()=>{window.reviewFixture.responseFail=true;});
 await form.getByLabel('Optional learner comment').fill('Keep on failure');await form.getByRole('checkbox').check();
 await form.getByRole('button',{name:'Save learner response'}).click();
 await expect(form.getByRole('alert')).toContainText('Response save was not confirmed');
 await expect(form.getByLabel('Optional learner comment')).toHaveValue('Keep on failure');
 await expect(form.getByRole('status')).not.toContainText('Response saved');
 await expect(form.getByRole('button',{name:'Retry response'})).toBeEnabled();
 await page.evaluate(()=>{window.reviewFixture.responseFail=false;});
 await form.getByRole('button',{name:'Retry response'}).click();await expect(form.getByRole('status')).toHaveText('✓ Response saved');
 const packets=await page.evaluate(()=>window.reviewFixture.packets);expect(packets[1].args).toEqual(packets[0].args);
});
test('existing receipt is obvious and permits a deliberate additional comment',async({page})=>{
 const form=await learnerResponse(page);
 await page.evaluate(()=>{window.reviewFixture.responses['00000000-0000-4000-8000-000000000701']=[{id:'existing',acknowledged_at:'2026-09-07T13:11:00Z',created_at:'2026-09-07T13:11:00Z',comment:'Prior receipt'}];window.dispatchEvent(new Event('focus'));});
 await expect(form.getByText('✓ Receipt acknowledged',{exact:true})).toBeVisible();
 await expect(form.getByRole('checkbox')).toBeDisabled();
 await expect(form.getByLabel('Add another comment')).toBeEnabled();
 await page.getByRole('button',{name:'Acknowledge / comment'}).click();await expect(form.getByLabel('Add another comment')).toBeFocused();
 expect(await page.evaluate(()=>window.reviewFixture.packets.length)).toBe(0);
});
test('learner background refresh preserves unsaved comment, scroll and focus',async({page})=>{
 const form=await learnerResponse(page),comment=form.getByLabel('Optional learner comment');
 await comment.fill('Unsaved learner comment');await comment.evaluate(el=>el.scrollIntoView({block:'center'}));
 const y=await page.evaluate(()=>scrollY);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(comment).toHaveValue('Unsaved learner comment');await expect(comment).toBeFocused();
 expect(await page.evaluate(()=>scrollY)).toBe(y);expect(await page.evaluate(()=>window.reviewFixture.packets.length)).toBe(0);
});
test('auth changes discard confirmed learner state and ignore late submission completion',async({page})=>{
 let form=await learnerResponse(page);await form.getByLabel('Optional learner comment').fill('Old success');
 await form.getByRole('button',{name:'Save learner response'}).click();await expect(form.getByRole('status')).toHaveText('✓ Response saved');
 await page.evaluate(()=>window.reviewFixture.setUser('00000000-0000-4000-8000-000000000002'));
 await expect(page.getByText('Old success',{exact:true})).toHaveCount(0);await expect(form.getByRole('status')).not.toContainText('Response saved');
 form=await learnerResponse(page);await page.evaluate(()=>{window.reviewFixture.responseDelay=600;});
 await form.getByLabel('Optional learner comment').fill('Old pending');await form.getByRole('button',{name:'Save learner response'}).click();
 await page.evaluate(()=>window.reviewFixture.setUser('00000000-0000-4000-8000-000000000002'));
 await expect(form.getByLabel('Optional learner comment')).toHaveValue('');
 await expect.poll(()=>page.evaluate(()=>Object.keys(window.reviewFixture.responses).length)).toBe(1);
 await expect(form.getByRole('status')).not.toContainText('Response saved');await expect(page.getByText('Old pending',{exact:true})).toHaveCount(0);
});
