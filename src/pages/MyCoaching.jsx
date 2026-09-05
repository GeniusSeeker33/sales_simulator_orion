import CompetencyBandPanel from "../components/CompetencyBandPanel";
import CompetencyEvidencePanel from "../components/CompetencyEvidencePanel";
import Layout from "../components/layout/Layout";
import CoachingPanel from "../components/CoachingPanel";
export default function MyCoaching() {
  return <Layout title="My coaching & competency evidence"><CoachingPanel /><CompetencyEvidencePanel /><CompetencyBandPanel /></Layout>;
}
