import { useEffect, useRef } from 'react';
import { friendly } from '../../lib/reviewPresentation';
export function Badge({ value }) { return <span className="review-badge">{friendly(value)}</span>; }
export function TechnicalDetails({ children, record }) { return <details className="review-technical"><summary>Technical details</summary>{children}{record && <pre>{JSON.stringify(record, null, 2)}</pre>}</details>; }
export function RecentRecords({ records = [], children }) {
  const recent = records.find(r => !r.superseded_by) || records[0];
  const older = records.filter(r => r !== recent);
  return <>{recent && <p className="review-caption">Most recent unsuperseded record on this page{recent.superseded_by ? " (only historical records available)" : ""}</p>}{recent && children(recent)}{older.length > 0 && <details className="review-history"><summary>View history ({older.length} other records on this page)</summary>{older.map(children)}</details>}</>;
}
export function FormCard({ children, onSubmit }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.querySelector('input, select, textarea, button')?.focus(); }, []);
  return <form ref={ref} className="card review-form" onSubmit={onSubmit}><p className="review-eyebrow">Human review · Required fields are marked *</p>{children}</form>;
}
