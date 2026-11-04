import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../api/assessment-invitations.js';
const uuid='11111111-1111-4111-8111-111111111111';
function response() {
  return {headers:{},code:0,body:null,setHeader(k,v){this.headers[k]=v;return this;},
    status(n){this.code=n;return this;},json(value){this.body=value;return this;}};
}
test('invitation endpoint requires authentication',async()=>{
  const res=response();
  await createHandler()({method:'POST',headers:{},body:{}},res);
  assert.equal(res.code,401);
});
test('invitation endpoint validates candidate identifiers',async()=>{
  const res=response();
  await createHandler()({method:'POST',headers:{authorization:'Bearer abc'},body:{workspace_id:'bad',person_id:uuid}},res);
  assert.equal(res.code,400);
});
test('authorized response never includes invitation token',async()=>{
  const makeClient=()=>({auth:{getUser:async()=>({data:{user:{id:uuid}}})}});
  const persist=async()=>({status:201,invitationId:uuid,expiresAt:'2099-01-01T00:00:00Z',token:'secret',delivery:'not_sent'});
  const previous={url:process.env.LEARNER_SUPABASE_URL,key:process.env.LEARNER_SUPABASE_PUBLISHABLE_KEY};
  process.env.LEARNER_SUPABASE_URL='https://example.supabase.co';
  process.env.LEARNER_SUPABASE_PUBLISHABLE_KEY='test';
  try {
    const res=response();
    await createHandler({makeClient,persist})({method:'POST',headers:{authorization:'Bearer abc'},body:{workspace_id:uuid,person_id:uuid}},res);
    assert.equal(res.code,202);
    assert.equal(res.body.delivery,'not_sent');
    assert.equal(JSON.stringify(res.body).includes('secret'),false);
  } finally {
    if(previous.url===undefined) delete process.env.LEARNER_SUPABASE_URL;
    else process.env.LEARNER_SUPABASE_URL=previous.url;
    if(previous.key===undefined) delete process.env.LEARNER_SUPABASE_PUBLISHABLE_KEY;
    else process.env.LEARNER_SUPABASE_PUBLISHABLE_KEY=previous.key;
  }
});
