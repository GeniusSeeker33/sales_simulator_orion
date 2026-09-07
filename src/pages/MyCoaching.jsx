import { useCallback, useEffect, useState } from "react";
import ProgressionPanel from "../components/ProgressionPanel";
import CompetencyBandPanel from "../components/CompetencyBandPanel";
import CompetencyEvidencePanel from "../components/CompetencyEvidencePanel";
import Layout from "../components/layout/Layout";
import CoachingPanel from "../components/CoachingPanel";
import { useAuth } from "../context/AuthContext";
import { learnerClient } from "../lib/learnerClient";
import { ReviewReportContext } from "../components/review/reviewReport";
import { Badge, TechnicalDetails } from "../components/review/ReviewPrimitives";
import { workflowStatus } from "../lib/reviewPresentation";
import "../styles/reviewer-workspace.css";
const stages = [["coaching", "Coaching"], ["evidence", "Competency Evidence"], ["bands", "Competency Bands"], ["progression", "Progression"]];
function goTo(stage, response = false) {
  const section = document.getElementById(`review-${stage}`);
  const target = response ? section?.querySelector("form input") : section?.querySelector("h2");
  if (target) { if (!response) target.tabIndex = -1; target.scrollIntoView({block:"center"}); target.focus(); }
}
function LearnerWorkspace() {
  const [snapshots, setSnapshots] = useState({});
  const report = useCallback((stage, data) => setSnapshots(old => ({...old, [stage]:data})), []);
  const latest = snapshots.coaching?.records?.find(record => !record.superseded_by);
  const acknowledged = latest?.responses?.some(response => response.acknowledged_at);
  return <ReviewReportContext.Provider value={report}><div className="review-workspace my-coaching-workspace">
    <section className="card review-learner"><div><p className="review-eyebrow">My development · current learner episode</p><h2>Your coaching & next steps</h2>
      <p>Read your coach’s feedback, acknowledge receipt, and share a comment. Your comments do not change the coach’s record.</p>
      {latest ? <><Badge value={latest.progress_status}/><p><strong>Next action:</strong> {latest.next_action}</p><p>Follow-up: {latest.follow_up_on || "Not set"} · {acknowledged ? "Receipt acknowledged" : "Receipt not yet acknowledged"}</p></> : <p>{snapshots.coaching ? "No current coaching on the loaded page." : "Checking your coaching…"}</p>}
    </div><div className="review-level"><span>Official level</span><strong>{snapshots.progression?.current_level || "Unavailable"}</strong><small>Human-approved history only</small></div>
      {snapshots.coaching && <TechnicalDetails record={{person_id:snapshots.coaching.person_id,employment_episode_id:snapshots.coaching.employment_episode_id}}/>}
    </section>
    <section className="card review-actions"><h2>What you can do next</h2><div className="review-action-buttons">
      <button className="review-primary" disabled={!latest} onClick={()=>goTo("coaching",true)}>Acknowledge / comment</button>
      <button onClick={()=>goTo("coaching")}>Read coaching</button><button onClick={()=>goTo("evidence")}>View competency evidence</button><button onClick={()=>goTo("progression")}>View progression</button>
    </div><p>Acknowledgment means receipt, not agreement. Competency and progression decisions are read-only here.</p></section>
    <ol className="review-workflow" aria-label="My development records">{stages.map(([stage,label])=><li key={stage}><strong>{label}</strong><span>{workflowStatus(stage,snapshots[stage])}</span></li>)}</ol>
    <p className="review-caption">Statuses summarize the most recent available records on each loaded page. They do not imply automatic advancement.</p>
    <CoachingPanel/><CompetencyEvidencePanel/><CompetencyBandPanel/><ProgressionPanel/>
  </div></ReviewReportContext.Provider>;
}
function LearnerBoundary({ userId }) {
  const [eventUser, setEventUser] = useState(userId);
  useEffect(()=>{
    const subscription=learnerClient?.auth.onAuthStateChange((_event,session)=>setEventUser(session?.user?.id || null));
    return ()=>subscription?.data.subscription.unsubscribe();
  },[]);
  return eventUser===userId ? <LearnerWorkspace/> : <p role="status">Account changed. Checking your coaching access…</p>;
}
export default function MyCoaching() {
  const {session}=useAuth();
  return <Layout title="My coaching & development">{session?.id ? <LearnerBoundary key={session.id} userId={session.id}/> : <p role="status">Sign in to view your coaching.</p>}</Layout>;
}
