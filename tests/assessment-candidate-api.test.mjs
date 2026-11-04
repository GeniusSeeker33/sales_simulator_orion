import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../api/assessment.js';

function response(){
 return {statusCode:0,body:null,headers:{},setHeader(k,v){this.headers[k]=v;return this;},
 status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
}
test('candidate endpoint rejects malformed token before querying database',async()=>{
 let called=false;
 const handler=createHandler({withDatabase:async()=>{called=true;}});
 const res=response();
 await handler({method:'GET',query:{token:'short'},headers:{}},res);
 assert.equal(res.statusCode,404);
 assert.equal(called,false);
});
test('candidate endpoint exposes only public question content',async()=>{
 const handler=createHandler({withDatabase:async fn=>fn(async()=>{})});
 // Mock the public read operation at the database boundary.
 const mock=createHandler({withDatabase:async()=>({status:200,assessment_version:'orion-sales-executive-v1',expires_at:'2099-01-01T00:00:00Z'})});
 const res=response();
 await mock({method:'GET',query:{token:'x'.repeat(43)},headers:{}},res);
 assert.equal(res.statusCode,200);
 assert.equal(res.body.questions.length,40);
 assert.equal(res.body.readiness_questions.length,6);
 assert.equal(JSON.stringify(res.body).includes('PROVISIONAL_RUBRIC'),false);
 assert.equal(JSON.stringify(res.body).includes('token_hash'),false);
 assert.ok(handler);
});
test('candidate submission never echoes responses or scores',async()=>{
 const handler=createHandler({withDatabase:async()=>({status:200,completed:true})});
 const res=response();
 await handler({method:'POST',headers:{'content-length':'200'},body:{token:'x'.repeat(43),responses:{'1':'A'}}},res);
 assert.equal(res.statusCode,200);
 assert.deepEqual(res.body,{completed:true});
});
