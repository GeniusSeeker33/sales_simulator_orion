import { createContext, useContext, useEffect } from 'react';
export const ReviewReportContext = createContext(null);
export function useReviewReport(stage, data) {
  const report = useContext(ReviewReportContext);
  useEffect(() => { report?.(stage, data); }, [report, stage, data]);
}
