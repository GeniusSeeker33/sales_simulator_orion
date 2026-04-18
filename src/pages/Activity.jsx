import { useMemo } from "react";
import Layout from "../components/layout/Layout";
import { formatCurrency } from "../lib/compEngine";
import { loadRepProfile } from "../lib/repProfileStore";
import { loadAccounts } from "../lib/accountStore";
import { loadTrainingResults } from "../lib/trainingStore";
import { getEmploymentMetrics } from "../data/compPlan";

export default function Activity() {
  const accounts = loadAccounts();
  const trainingResults = loadTrainingResults();
  const repProfile = loadRepProfile();

  const activityFeed = useMemo(() => {
    const accountEvents = buildAccountActivity(accounts);
    const trainingEvents = buildTrainingActivity(trainingResults);
    const repMetricEvents = buildRepMetricsActivity(repProfile);

    return [...trainingEvents, ...repMetricEvents, ...accountEvents].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [accounts, trainingResults, repProfile]);

  const summary = useMemo(() => {
    const trainingCount = trainingResults.length;
    const accountUpdates = accounts.filter((account) => account.updatedAt).length;
    const repMetricsUpdated = Boolean(repProfile.updatedAt);

    return {
      totalEvents: activityFeed.length,
      trainingCount,
      accountUpdates,
      repMetricsUpdated,
    };
  }, [activityFeed, trainingResults, accounts, repProfile]);

  return (
    <Layout title="Activity">
      <section className="kpi-grid">
        <div className="card">
          <div className="card-label">Total Events</div>
          <div className="card-value">{summary.totalEvents}</div>
          <div className="card-note">Combined activity across the simulator</div>
        </div>

        <div className="card">
          <div className="card-label">Training Events</div>
          <div className="card-value">{summary.trainingCount}</div>
          <div className="card-note">Completed practice sessions</div>
        </div>

        <div className="card">
          <div className="card-label">Account Updates</div>
          <div className="card-value">{summary.accountUpdates}</div>
          <div className="card-note">Dealer plans updated and saved</div>
        </div>

        <div className="card">
          <div className="card-label">Rep Metrics</div>
          <div className="card-value">
            {summary.repMetricsUpdated ? "Updated" : "Not Yet"}
          </div>
          <div className="card-note">Compensation input status</div>
        </div>
      </section>

      <section className="dashboard-main-grid">
        <div className="dashboard-main-stack">
          <div className="card">
            <div className="section-header">
              <div>
                <h2>Live Activity Feed</h2>
                <p className="section-subtext">
                  A running timeline of rep actions, account changes, and performance events.
                </p>
              </div>
            </div>

            {activityFeed.length > 0 ? (
              <div className="history-list">
                {activityFeed.map((event) => (
                  <div key={event.id} className="card" style={{ marginBottom: 12 }}>
                    <div className="section-header">
                      <div>
                        <h2 style={{ fontSize: "1rem", marginBottom: 6 }}>
                          {event.title}
                        </h2>
                        <p className="section-subtext">{event.subtitle}</p>
                      </div>

                      <span className={`status-pill ${event.toneClass}`}>
                        {event.badge}
                      </span>
                    </div>

                    {event.rows?.length ? (
                      <div style={{ marginTop: 12 }}>
                        {event.rows.map((row) => (
                          <div key={row.label} className="feedback-row">
                            <span>{row.label}</span>
                            <strong>{row.value}</strong>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {event.description ? (
                      <p className="coach-text" style={{ marginTop: 12 }}>
                        {event.description}
                      </p>
                    ) : null}

                    <div className="card-note" style={{ marginTop: 12 }}>
                      {formatTimestamp(event.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="coach-text">
                No activity yet. Update an account plan, complete training, or save rep
                metrics to begin building the timeline.
              </p>
            )}
          </div>
        </div>

        <div className="dashboard-side-stack">
          <div className="card">
            <h2>Leadership View</h2>

            <div className="feedback-row">
              <span>Training Recorded</span>
              <strong>{summary.trainingCount}</strong>
            </div>

            <div className="feedback-row">
              <span>Dealer Plans Updated</span>
              <strong>{summary.accountUpdates}</strong>
            </div>

            <div className="feedback-row">
              <span>Comp Data Saved</span>
              <strong>{summary.repMetricsUpdated ? "Yes" : "No"}</strong>
            </div>

            <p className="coach-text">
              This page gives Orion leadership a visible trail of rep behavior:
              practice, planning, and compensation inputs all in one place.
            </p>
          </div>

          <div className="card">
            <h2>What Counts as Activity?</h2>

            <div className="feedback-row">
              <span>Training Completion</span>
              <strong>Included</strong>
            </div>

            <div className="feedback-row">
              <span>Account Plan Save</span>
              <strong>Included</strong>
            </div>

            <div className="feedback-row">
              <span>Rep Metrics Save</span>
              <strong>Included</strong>
            </div>

            <p className="coach-text">
              As the app grows, this timeline can also include notes, manager reviews,
              call outcomes, and leaderboard movement.
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}

function buildTrainingActivity(trainingResults) {
  return trainingResults.map((entry) => ({
    id: `training-${entry.id}`,
    timestamp: entry.completedAt || new Date().toISOString(),
    title: `Training completed: ${entry.scenarioType || "Scenario"}`,
    subtitle: entry.dealerName
      ? `Dealer context: ${entry.dealerName}`
      : "Scenario training activity",
    badge: "Training",
    toneClass: "status-positive",
    rows: [
      {
        label: "Dealer",
        value: entry.dealerName || "—",
      },
      {
        label: "Score",
        value: `${entry.totalScore ?? entry.score ?? 0}/100`,
      },
      {
        label: "Primary Buyer",
        value: entry.primaryBuyer || "—",
      },
    ],
    description:
      entry.repSummary?.coachNotes ||
      "Training result saved to readiness history.",
  }));
}

function buildRepMetricsActivity(repProfile) {
  if (!repProfile?.updatedAt) return [];

  const employment = getEmploymentMetrics(repProfile.startDate);

  return [
    {
      id: "rep-metrics-update",
      timestamp: repProfile.updatedAt,
      title: "Rep metrics updated",
      subtitle: repProfile.repName || "AE User",
      badge: "Comp",
      toneClass: employment.kpiMeasurementActive
        ? "status-positive"
        : "status-neutral",
      rows: [
        {
          label: "Start Date",
          value: repProfile.startDate || "—",
        },
        {
          label: "Days Employed",
          value: employment.daysEmployed,
        },
        {
          label: "Employment Month",
          value: employment.employmentMonth,
        },
        {
          label: "Measured KPI Month",
          value: employment.kpiMeasurementActive
            ? employment.measuredMonth
            : "Not active",
        },
        {
          label: "Revenue",
          value: formatCurrency(repProfile.revenue ?? 0),
        },
        {
          label: "Captures",
          value: repProfile.captures ?? 0,
        },
        {
          label: "Customers Sold",
          value: repProfile.customersSold ?? 0,
        },
      ],
      description: employment.kpiMeasurementActive
        ? "Compensation inputs were saved and are now driving the dashboard compensation view."
        : "Rep profile updated. KPI measurement has not started yet because the first 4 weeks are still in progress.",
    },
  ];
}

function buildAccountActivity(accounts) {
  return accounts
    .filter((account) => account.updatedAt)
    .map((account) => ({
      id: `account-${account.id}`,
      timestamp: account.updatedAt,
      title: `Account plan updated: ${account.dealerName}`,
      subtitle: account.primaryBuyer || "Dealer account",
      badge: "Account",
      toneClass: "status-neutral",
      rows: [
        {
          label: "Category to Expand",
          value: account.categoryToExpand || "—",
        },
        {
          label: "SKU Focus",
          value: account.skuFocus?.length ? account.skuFocus.join(", ") : "—",
        },
        {
          label: "Barrier",
          value: account.barrier || "—",
        },
      ],
      description:
        account.howWeGetThere || "Dealer strategy updated and saved.",
    }));
}

function formatTimestamp(value) {
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}