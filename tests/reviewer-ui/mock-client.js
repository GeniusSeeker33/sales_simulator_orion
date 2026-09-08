const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
import { competencyVersion as version } from '../../src/data/coachingTargets';
const time='2026-09-06T13:22:00Z';
const listeners=new Set(), authListeners=new Set();
export const fixture={userId:id(1),delay:0,responseDelay:0,responseFail:false,responses:{},deny:false,calls:[],packets:[],subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},setUser(value){fixture.userId=value;authListeners.forEach(fn=>fn(value?'SIGNED_IN':'SIGNED_OUT',value?{user:{id:value}}:null));listeners.forEach(fn=>fn());}};
window.reviewFixture=fixture;
const scopes=[1,2].map(n=>({id:id(100+n),person_id:id(200+n),employment_episode_id:id(300+n),learner_binding_id:id(400+n),organization_scope:n===1?'Orion Pilot':'Orion Rehire Pilot',role_scope_ref:'Sales pilot',reviewer_role:'coach',binding_retired:false}));
const practice=n=>({id:id(500+n),revision:2,kind:'simulation',scenario_ref:n===1?'rushed-buyer':'expert-buyer',status:'completed',assessment_status:'ai_unreviewed',ai_overall:65,started_at:time,ended_at:time,session:{id:id(550+n),revision:2,status:'completed',scenario_ref:'rushed-buyer',started_at:time}});
const evidence=n=>({id:id(600+n),revision:1,competency_code:'C01',competency_version:version,source_type:'ai_practice',finding:'supports',evidence_date:'2026-09-06',created_at:time,reviewer_user_id:id(1),observed_behavior:'Asked a focused question and acknowledged the dealer concern.',evidence:{kind:'attempt',id:id(500+n),revision:2,status:'completed'},can_correct:true});
const coaching=n=>({id:id(700+n),revision:1,occurred_at:time,created_at:time,coach_user_id:id(1),competency_version:version,targets:['C01'],progress_status:'follow_up_pending',observed_behavior:'Clarified the dealer priorities.',strengths:'Listened without interrupting.',development_opportunity:'Confirm the next step.',next_action:'Practice a concise recap.',follow_up_on:'2026-09-10',responses:[],evidence:[{kind:'attempt',id:id(500+n),revision:2}],can_correct:true});
export const learnerClient={auth:{onAuthStateChange(fn){authListeners.add(fn);return{data:{subscription:{unsubscribe(){authListeners.delete(fn);}}}};}},async rpc(name,args){
 fixture.calls.push(name);
 const scope=args.p_scope || args.p_scope_id;
 const n=scope ? (scope===scopes[1].id?2:1) : (fixture.userId===id(1)?1:2);
 if(fixture.delay && scope) await new Promise(r=>setTimeout(r,fixture.delay));
 if(fixture.deny && scope) return{error:{message:'Reviewer access denied'}};
 if(name==='respond_to_coaching'){
  fixture.packets.push({name,args});
  if(fixture.responseDelay)await new Promise(r=>setTimeout(r,fixture.responseDelay));
  if(fixture.responseFail)return{error:{message:'Simulated failure'}};
  const list=fixture.responses[args.p_session] || [];
  if(!list.some(r=>r.id===args.p_id))list.push({id:args.p_id,created_at:time,acknowledged_at:args.p_ack?time:null,comment:args.p_comment});
  fixture.responses[args.p_session]=list;return{data:args.p_id,error:null};
 }
 if(name.startsWith('publish_')){fixture.packets.push({name,args});return{data:{},error:null};}
 const common={person_id:id(200+n),employment_episode_id:id(300+n),can_create:!!scope};
 if(name==='read_reviewer_history') return{data:{scopes:fixture.userId===id(1)?scopes:scopes.slice(1),records:scope?[practice(n),{...practice(n),id:id(590+n),scenario_ref:'older-practice',session:null,status:'technical_failure',ai_overall:null}]:[]}};
 if(name==='read_coaching_sessions') return{data:{...common,records:[{...coaching(n),responses:fixture.responses[id(700+n)] || [],can_correct:!!scope}]}};
 if(name==='read_competency_evidence') return{data:{...common,records:[{...evidence(n),can_correct:!!scope},{...evidence(n),id:id(650+n),superseded_by:id(600+n),can_correct:false}]}};
 if(name==='read_competency_band_reviews') return{data:{...common,records:[{id:id(800+n),revision:1,competency_code:'C01',competency_version:version,outcome:'B2',reviewed_at:time,created_at:time,rationale:'Human review supports the behavioral anchor.',evidence:[evidence(n)],can_correct:!!scope}]}};
 if(name==='read_progression_reviews') return{data:{...common,current_level:'L1',current_history_id:id(900+n),records:[]}};
 return {error:{message:'Unexpected fixture RPC'}};
}};
