import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SALES_EXECUTIVE_QUESTIONS } from '../assessments/orionSalesExecutiveQuestions.js';
import { EMPLOYMENT_READINESS_QUESTIONS } from '../assessments/orionEmploymentReadinessQuestions.js';
import './CandidateAssessment.css';

const ALL_QUESTIONS = [...SALES_EXECUTIVE_QUESTIONS, ...EMPLOYMENT_READINESS_QUESTIONS];
export function isAssessmentComplete(answers) {
  return ALL_QUESTIONS.every(q => q.options.some(o => o.value === answers[q.field || String(q.id)]));
}
export function buildAssessmentPayload(answers) {
  if (!isAssessmentComplete(answers)) throw new Error('All 46 questions must be answered.');
  return {
    responses: Object.fromEntries(SALES_EXECUTIVE_QUESTIONS.map(q=>[String(q.id),answers[String(q.id)]])),
    readiness: Object.fromEntries(EMPLOYMENT_READINESS_QUESTIONS.map(q=>[q.field,answers[q.field]]).concat([['anticipated_dates', answers.anticipated_dates || '']]))
  };
}
export default function CandidateAssessment() {
  const { token } = useParams();
  const [answers,setAnswers] = useState({});
  const [page,setPage] = useState(0);
  const [notice,setNotice] = useState('');
  const [verified,setVerified] = useState(!token);
  const [submitting,setSubmitting] = useState(false);
  const [completed,setCompleted] = useState(false);
  useEffect(()=>{
    if(!token) return undefined;
    const controller=new AbortController();
    fetch('/api/assessment?token='+encodeURIComponent(token),{signal:controller.signal,cache:'no-store'})
      .then(async response=>{if(!response.ok) throw new Error('This invitation is unavailable or expired.');return response.json();})
      .then(()=>setVerified(true))
      .catch(error=>{if(!controller.signal.aborted) setNotice(error.message);});
    return ()=>controller.abort();
  },[token]);
  async function submit() {
    if(!token||!verified||!isAssessmentComplete(answers)||submitting) return;
    setSubmitting(true);
    try {
      const response=await fetch('/api/assessment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,...buildAssessmentPayload(answers)})});
      if(!response.ok) {const data=await response.json();throw new Error(data.error||'Unable to submit assessment.');}
      setCompleted(true);
      setNotice('Your assessment was submitted successfully. Thank you.');
    } catch(error) {setNotice(error.message);} finally {setSubmitting(false);}
  }
  const groups = useMemo(()=>[
    ...Array.from(new Set(SALES_EXECUTIVE_QUESTIONS.map(q=>q.section))).map(section=>({title:section,questions:SALES_EXECUTIVE_QUESTIONS.filter(q=>q.section===section)})),
    {title:'Employment Readiness (unscored)',questions:EMPLOYMENT_READINESS_QUESTIONS}
  ],[]);
  const current=groups[page];
  const count=ALL_QUESTIONS.filter(q=>answers[q.field || String(q.id)]).length;
  function next() {
    const unanswered=current.questions.find(q=>!answers[q.field || String(q.id)]);
    if(unanswered) {
      setNotice('Please answer every question in this section before continuing.');
      document.getElementById('assessment-question-'+unanswered.id)?.focus();
      return;
    }
    setNotice('');
    if(page<groups.length-1) setPage(p=>p+1);
    else if(token) submit();
    else setNotice('Preview complete. No answers have been submitted.');
  }
  return <main className="candidate-assessment">
    <header>
      <p className="assessment-eyebrow">Orion Wholesale · Sales Executive</p>
      <h1>Sales Executive Assessment</h1>
      <p>Choose the response that best reflects how you would handle each situation. There are 40 sales scenarios and six separate employment-readiness questions.</p>
      {!token && <p className="assessment-note">Preview only — responses are not submitted or saved to Orion yet.</p>}
      {!token && <p className="assessment-note">Administrator preview: a secure invitation is required for submission.</p>}
    </header>
    {completed ? <p role="status">Your assessment has been received. You may close this page.</p> : <>
    {token && !verified && <p role="status">Verifying invitation…</p>}
    <div className="assessment-progress" aria-label={count+' of 46 questions answered'}>
      <div style={{width:(count/46*100)+'%'}} />
    </div>
    <p className="assessment-meta">{count} of 46 answered · Section {page+1} of {groups.length}</p>
    <section aria-label={current.title}>
      <h2>{current.title}</h2>
      {current.questions.map(q=>{
        const key=q.field || String(q.id);
        return <fieldset key={q.id} id={'assessment-question-'+q.id} tabIndex="-1">
          <legend><strong>{q.id}. {q.prompt}</strong></legend>
          {q.options.map(o=><label key={o.value} className={'assessment-option'+(answers[key]===o.value?' selected':'')}>
            <input type="radio" name={'q-'+q.id} value={o.value} checked={answers[key]===o.value} onChange={()=>{setAnswers(a=>({...a,[key]:o.value}));setNotice('');}}/>
            <span>{o.label}</span>
          </label>)}
          {q.followUp?.when.includes(answers[key]) && <label className="assessment-followup">{q.followUp.label}
            <textarea maxLength={q.followUp.maxLength} value={answers[q.followUp.field] || ''} onChange={e=>setAnswers(a=>({...a,[q.followUp.field]:e.target.value}))}/>
          </label>}
        </fieldset>;
      })}
    </section>
    {notice && <p role="status" className="assessment-note">{notice}</p>}
    <nav className="assessment-nav" aria-label="Assessment sections">
      <button type="button" disabled={page===0} onClick={()=>{setPage(p=>p-1);setNotice('');}}>Previous</button>
      <button type="button" disabled={submitting||Boolean(token&&!verified)} onClick={next}>{page===groups.length-1?(token?(submitting?'Submitting…':'Submit assessment'):'Review completion'):'Next section'}</button>
    </nav>
    </>}
  </main>;
}
