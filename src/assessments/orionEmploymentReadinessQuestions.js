// Candidate-facing employment-readiness questions. These are not part of the sales score.
// Confirm exact Orion written dress policy and work schedule before publishing.
export const EMPLOYMENT_READINESS_QUESTIONS = [
  { id:41, field:'transportation', prompt:'Do you have reliable transportation to and from work each scheduled workday?', options:[
    {value:'own',label:'Yes, I have my own vehicle.'},
    {value:'rideshare',label:'Yes, I use Uber, Lyft, or another rideshare service.'},
    {value:'family',label:'Yes, a family member or friend provides transportation.'},
    {value:'other',label:'Yes, I have another reliable transportation arrangement.'},
    {value:'no',label:'No, I do not currently have reliable transportation.'}
  ]},
  { id:42, field:'dress_code', prompt:'Orion requires employees to follow its professional office dress code, including restrictions on jeans, athletic shoes, ball caps, and dirty or excessively worn clothing. Are you willing and able to follow the written dress code, with applicable accommodations?', options:[
    {value:'yes',label:'Yes, I understand and can comply.'},
    {value:'clarify',label:'I would like clarification about acceptable attire.'},
    {value:'no',label:'No, I cannot meet this requirement.'}
  ]},
  { id:43, field:'planned_time_off', prompt:'Do you have any planned vacations, travel, or other anticipated time-off commitments during the next six months?', options:[
    {value:'yes',label:'Yes.'},{value:'no',label:'No.'},{value:'maybe',label:'Maybe / plans are not finalized.'}
  ], followUp:{field:'anticipated_dates',when:['yes','maybe'],label:'Anticipated dates or date ranges, if known (do not include personal reasons)',maxLength:500}},
  { id:44, field:'onsite_schedule', prompt:'This is a full-time, onsite position in Jeffersonville, Indiana, requiring consistent attendance and punctuality. Can you meet the established work schedule?', options:[
    {value:'yes',label:'Yes, I can meet the schedule.'},
    {value:'clarify',label:'I would like clarification about the schedule.'},
    {value:'no',label:'No, I cannot meet the schedule as described.'}
  ]},
  { id:45, field:'start_availability', prompt:'If selected for employment, when would you be available to begin working?', options:[
    {value:'immediate',label:'Immediately.'},{value:'two',label:'Within two weeks.'},
    {value:'month',label:'Within 30 days.'},{value:'later',label:'More than 30 days.'}
  ]},
  { id:46, field:'compensation_understanding', prompt:'The Sales Executive position includes a base salary and performance-based commissions. Significant commission income takes time to develop and earnings are not guaranteed. Do you understand this compensation structure?', options:[
    {value:'yes',label:'Yes, I understand.'},
    {value:'clarify',label:'I would like additional information.'},
    {value:'no',label:'No, this compensation structure does not align with my expectations.'}
  ]}
];
export function validateReadinessQuestionBank(questions=EMPLOYMENT_READINESS_QUESTIONS) {
  if (questions.length!==6 || new Set(questions.map(q=>q.field)).size!==6) return false;
  return questions.every(q=>q.prompt && q.options.length>=3 && new Set(q.options.map(o=>o.value)).size===q.options.length);
}
