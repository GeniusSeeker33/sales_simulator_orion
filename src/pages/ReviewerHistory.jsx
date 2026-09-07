import { ReviewReportContext } from "../components/review/reviewReport";
import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { learnerClient } from '../lib/learnerClient';
import { fetchReviewerHistory, reviewAssessmentLabel } from '../lib/reviewerHistory';
import { learnerLabels, friendly, workflowStatus } from '../lib/reviewPresentation';
import CoachingPanel from '../components/CoachingPanel';
import CompetencyEvidencePanel from '../components/CompetencyEvidencePanel';
import CompetencyBandPanel from '../components/CompetencyBandPanel';
import ProgressionPanel from '../components/ProgressionPanel';
import { Badge, TechnicalDetails, RecentRecords } from '../components/review/ReviewPrimitives';
import '../styles/reviewer-workspace.css';
const stages = [['practice','Practice'],['coaching','Coaching'],['evidence','Competency Evidence'],['bands','Band Review'],['progression','Progression Review']];
const actions = [['coaching','Record Coaching'],['evidence','Record Competency Evidence'],['bands','Review Competency'],['progression','Review Progression']];
function startAction(stage) {
  const section = document.getElementById(`review-${stage}`);
  section?.scrollIntoView({block:'start'});
  const action = section?.querySelector('[data-create]');
  if (action) { action.focus(); action.click(); }
  else section?.querySelector("form input, form select, form textarea")?.focus();
}
function EpisodeWorkspace({ scope, label }) {
  const [cursor,setCursor] = useState(null);
  const [revision,setRevision] = useState(0);
  const [result,setResult] = useState(null);
  const [snapshots,setSnapshots] = useState({});
  const report = useCallback((stage,data)=>setSnapshots(old=>({...old,[stage]:data})),[]);
  const key = JSON.stringify([scope.id,cursor,revision]);
  useEffect(()=>{
    let live=true;
    fetchReviewerHistory(learnerClient,scope.id,cursor).then(data=>{if(live)setResult({key,data});}).catch(e=>{if(live)setResult({key,error:e.message});});
    return ()=>{live=false;};
  },[key,scope.id,cursor]);
  useEffect(()=>{
    const refresh=()=>setRevision(n=>n+1);const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);
    return ()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[]);
  const fresh=result?.key===key;
  const data=fresh ? result?.data : null;
  const authorized=data?.scopes.some(s=>s.id===scope.id);
  // The subtree remains mounted during same-episode refresh to preserve pending retry packets,
  // but no old data/actions are visible while access is being checked. Episode/user keys reset it.
  return <ReviewReportContext.Provider value={report}>
    <section className="card review-learner"><div><p className="review-eyebrow">Selected learner · one employment episode</p><h2>{label}</h2>
      <p>{scope.role_scope_ref || 'Role context unavailable'} · {scope.organization_scope || 'Organization unavailable'}</p>
      <p>Your reviewer role: <strong>{friendly(scope.reviewer_role)}</strong>{scope.binding_retired && ' · Historical employment binding'}</p></div>
      <div className="review-level"><span>Official level</span><strong>{authorized ? snapshots.progression?.current_level || 'Unavailable' : 'Checking…'}</strong><small>Human-approved history only</small></div>
      <TechnicalDetails record={scope}/>
    </section>
    {!fresh && <p role="status">Loading selected episode / checking access…</p>}
    {fresh && result.error && <p role="alert">{result.error}</p>}
    {fresh && data && !authorized && <p role="alert">This scope is no longer available. Select another approved episode.</p>}
    <div hidden={!authorized}>
      <section className="card review-actions"><h2>Next actions</h2><p>Choose the next human review. These stages do not automatically advance the learner.</p>
        <div className="review-action-buttons">{actions.map(([stage,title],i)=><button type="button" className={i===0?'review-primary':''} key={stage} disabled={!authorized || !snapshots[stage]?.can_create} onClick={()=>startAction(stage)}>{title}</button>)}</div>
        <small>Actions become available only after each section confirms access. Unavailable actions may need initial provisioning or refreshed access.</small>
      </section>
      <ol className="review-workflow" aria-label="Development workflow">{stages.map(([stage,title])=><li key={stage}><strong>{title}</strong><span>{workflowStatus(stage,stage==='practice'?data:snapshots[stage])}</span></li>)}</ol>
      <p className="review-caption">Status summarizes the most recent available record, not complete competency coverage or automatic eligibility.</p>
      <section className="card review-section" id="review-practice"><h2>Recent Practice</h2><button onClick={()=>setRevision(n=>n+1)}>Refresh practice and access</button>
        {data?.records.length===0 && <p>No durable practice on this page.</p>}
        <RecentRecords records={data?.records}>{record=><article className="card" key={record.id}><h3>{friendly(record.scenario_ref)}</h3>
          <p>{record.kind==='written'?'Written practice':'Simulation practice'} · {new Date(record.started_at).toLocaleString()}</p><Badge value={record.status}/><Badge value={record.status==='technical_failure'?'unscored':record.assessment_status || 'unscored'}/>
          <p className="review-score">{reviewAssessmentLabel(record)}</p>
          <button disabled={!snapshots.coaching?.can_create} onClick={()=>startAction('coaching')}>Review for Coaching</button>
          <TechnicalDetails record={record}/>
        </article>}</RecentRecords>
        <details className="review-history"><summary>View history / practice pages</summary><p>Up to 50 occurrences per page. Dates use your browser timezone.</p>{cursor && <button onClick={()=>setCursor(null)}>Newest records</button>}{data?.hasMore && <button onClick={()=>{const last=data.records.at(-1);setCursor({started_at:last.started_at,id:last.id});}}>Older records</button>}</details>
      </section>
    </div>
    <div hidden={!authorized} className="review-sections">
      <CoachingPanel scopeId={scope.id}/><CompetencyEvidencePanel scopeId={scope.id}/><CompetencyBandPanel scopeId={scope.id}/><ProgressionPanel scopeId={scope.id}/>
    </div>
  </ReviewReportContext.Provider>;
}
function ReviewerWorkspace() {
  const [scopeId,setScopeId]=useState('');
  const [result,setResult]=useState(null);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let live=true;
    fetchReviewerHistory(learnerClient).then(data=>{if(live)setResult({revision,data});}).catch(e=>{if(live)setResult({revision,error:e.message});});
    return ()=>{live=false;};
  },[revision]);
  const fresh=result?.revision===revision;
  const scopes=fresh?result?.data?.scopes || []:[];
  const labels=learnerLabels(scopes);
  const selected=scopes.find(s=>s.id===scopeId);
  return <div className="review-workspace"><section className="card review-selection"><p className="review-eyebrow">Manager / coach workspace</p><h2>Who are you reviewing?</h2>
    <p>Choose an approved learner episode. Numbered labels are private display aliases for this list, not verified names.</p>
    <label>Assigned learner / episode<select value={selected?scopeId:''} onChange={e=>setScopeId(e.target.value)} disabled={!fresh}><option value="">Select a learner episode</option>{scopes.map(scope=><option key={scope.id} value={scope.id}>{labels[scope.id]} · {scope.organization_scope} · {friendly(scope.reviewer_role)}</option>)}</select></label>
    <button onClick={()=>{setScopeId('');setRevision(n=>n+1);}}>Refresh assigned learners</button>
    {!fresh && <p role="status">Checking reviewer access…</p>}{fresh && result.error && <p role="alert">{result.error}</p>}{fresh && !result.error && !scopes.length && <p>No approved learner episodes are available.</p>}
  </section>{selected && <EpisodeWorkspace key={selected.id} scope={selected} label={labels[selected.id]}/>}</div>;
}
function AuthBoundary({ userId }) {
  const [eventUser,setEventUser]=useState(userId);
  useEffect(()=>{
    const subscription=learnerClient?.auth.onAuthStateChange((_event,session)=>setEventUser(session?.user?.id || null));
    return ()=>subscription?.data.subscription.unsubscribe();
  },[]);
  // Auth events clear the subtree immediately; the existing verified AuthContext must catch up.
  return eventUser===userId ? <ReviewerWorkspace/> : <p role="status">Account changed. Checking access…</p>;
}
export default function ReviewerHistory() {
  const {session}=useAuth();
  return <Layout title="Learner development"><div>{session?.id ? <AuthBoundary key={session.id} userId={session.id}/> : <p role="status">Sign in with your verified reviewer account.</p>}</div></Layout>;
}
