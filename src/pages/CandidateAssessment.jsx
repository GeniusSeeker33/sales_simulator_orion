import { useMemo, useState } from 'react';
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
    else setNotice('Your answers are complete. Submission will be enabled when your secure invitation is verified.');
  }
  return <main className="candidate-assessment">
    <header>
      <p className="assessment-eyebrow">Orion Wholesale · Sales Executive</p>
      <h1>Sales Executive Assessment</h1>
      <p>Choose the response that best reflects how you would handle each situation. There are 40 sales scenarios and six separate employment-readiness questions.</p>
      <p className="assessment-note">Preview only — responses are not submitted or saved to Orion yet.</p>
      {!token && <p role="alert">A secure invitation link is required to take this assessment.</p>}
    </header>
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
      <button type="button" onClick={next}>{page===groups.length-1?'Review completion':'Next section'}</button>
    </nav>
  </main>;
}
