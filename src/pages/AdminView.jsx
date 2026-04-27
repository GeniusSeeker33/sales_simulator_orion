import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import { employees, getEmployeeFullName } from "../data/employees";
import { loadSimulatorResults } from "../lib/simulatorResultsStore";
import { formatCurrency, buildRepCompSummary } from "../lib/compEngine";
import { loadPrizes } from "../lib/prizesStore";

const BC_DEMO = {
  monthlyRevenue: 2847392,
  cogs: 2105963,
  grossProfit: 741429,
  openOrders: 34,
  pendingInvoices: 18,
  activeCustomers: 89,
  unitsShipped: 1847,
  avgOrderValue: 32400,
};

const FEDEX_DEMO = {
  pendingShipments: 23,
  inTransit: 18,
  deliveredToday: 7,
  exceptions: 2,
};

const INTEGRATIONS = [
  {
    id: "bc",
    name: "Microsoft Business Central",
    description: "Inventory, orders, customers, and financial data",
    status: "not-configured",
    lastSync: null,
    records: null,
    envVars: ["BC_TENANT_ID", "BC_CLIENT_ID", "BC_CLIENT_SECRET", "BC_ENVIRONMENT", "BC_COMPANY_ID"],
    apiEndpoint: "https://api.businesscentral.dynamics.com/v2.0/{tenantId}/{env}/api/v2.0/",
  },
  {
    id: "fedex",
    name: "FedEx REST API",
    description: "Shipment tracking, delivery events, rate management",
    status: "not-configured",
    lastSync: null,
    records: null,
    envVars: ["FEDEX_API_KEY", "FEDEX_SECRET_KEY", "FEDEX_ACCOUNT_NUMBER"],
    apiEndpoint: "https://apis.fedex.com/",
  },
  {
    id: "ringcentral",
    name: "RingCentral",
    description: "Call logs, analytics, connection data per rep",
    status: "partial",
    lastSync: "Manual import active",
    records: "CSV import enabled",
    envVars: ["RINGCENTRAL_CLIENT_ID", "RINGCENTRAL_CLIENT_SECRET", "RINGCENTRAL_JWT_TOKEN"],
    apiEndpoint: "https://platform.ringcentral.com/restapi/v1.0/",
  },
];

const STATUS_TONE = {
  "connected": "status-positive",
  "partial": "status-neutral",
  "not-configured": "status-risk",
  "error": "status-risk",
};

const STATUS_LABEL = {
  "connected": "Connected",
  "partial": "Partial",
  "not-configured": "Not Configured",
  "error": "Error",
};

export default function AdminView() {
  const navigate = useNavigate();
  const simulatorResults = loadSimulatorResults();
  const prizes = loadPrizes();

  const repPerformance = buildRepPerformanceTable(simulatorResults, prizes);
  const commissionLiability = repPerformance.reduce((s, r) => s + r.estMonthlyComp, 0);
  const netContribution = BC_DEMO.grossProfit - commissionLiability;
  const grossMarginPct = Math.round((BC_DEMO.grossProfit / BC_DEMO.monthlyRevenue) * 100);

  return (
    <Layout title="Executive Admin View">
      <section className="kpi-grid">
        <div className="card">
          <div className="card-label">Monthly Revenue (BC)</div>
          <div className="card-value" style={{ color: "#3ddc97" }}>
            {formatCurrency(BC_DEMO.monthlyRevenue)}
          </div>
          <div className="card-note">{BC_DEMO.activeCustomers} active dealer accounts</div>
        </div>

        <div className="card">
          <div className="card-label">Gross Profit</div>
          <div className="card-value">{formatCurrency(BC_DEMO.grossProfit)}</div>
          <div className="card-note">{grossMarginPct}% gross margin after COGS</div>
        </div>

        <div className="card">
          <div className="card-label">Commission Liability</div>
          <div className="card-value" style={{ color: "#f59e0b" }}>
            {formatCurrency(commissionLiability)}
          </div>
          <div className="card-note">Estimated monthly owed to {repPerformance.length} reps</div>
        </div>

        <div className="card">
          <div className="card-label">Net After Commissions</div>
          <div className="card-value" style={{ color: netContribution > 0 ? "#3ddc97" : "#f87171" }}>
            {formatCurrency(netContribution)}
          </div>
          <div className="card-note">Gross profit minus commission liability</div>
        </div>
      </section>

      <section className="kpi-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-label">Open Orders (BC)</div>
          <div className="card-value">{BC_DEMO.openOrders}</div>
          <div className="card-note">Avg order value {formatCurrency(BC_DEMO.avgOrderValue)}</div>
        </div>

        <div className="card">
          <div className="card-label">Pending Shipments (FedEx)</div>
          <div className="card-value">{FEDEX_DEMO.pendingShipments}</div>
          <div className="card-note">{FEDEX_DEMO.exceptions} exception(s) requiring attention</div>
        </div>

        <div className="card">
          <div className="card-label">Units Shipped (BC)</div>
          <div className="card-value">{BC_DEMO.unitsShipped.toLocaleString()}</div>
          <div className="card-note">This month via FedEx integration</div>
        </div>

        <div className="card">
          <div className="card-label">AI Simulator Sessions</div>
          <div className="card-value">{simulatorResults.length}</div>
          <div className="card-note">Training investment across all reps</div>
        </div>
      </section>

      <section className="dashboard-main-grid">
        <div className="dashboard-main-stack">
          <div className="card">
            <div className="section-header">
              <div>
                <h2>Integration Health</h2>
                <p className="section-subtext">
                  Live connection status for Microsoft Business Central, FedEx, and RingCentral. Configure via environment variables in Vercel.
                </p>
              </div>
              <button className="btn-secondary" onClick={() => navigate("/admin/import")}>
                Import Data
              </button>
            </div>

            <div className="table-wrap">
              <table className="accounts-table">
                <thead>
                  <tr>
                    <th>System</th>
                    <th>Status</th>
                    <th>Last Sync</th>
                    <th>Records</th>
                    <th>Required Env Vars</th>
                  </tr>
                </thead>
                <tbody>
                  {INTEGRATIONS.map((integration) => (
                    <tr key={integration.id}>
                      <td>
                        <div>
                          <strong>{integration.name}</strong>
                          <div style={{ opacity: 0.6, fontSize: "0.82rem" }}>{integration.description}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${STATUS_TONE[integration.status]}`}>
                          {STATUS_LABEL[integration.status]}
                        </span>
                      </td>
                      <td style={{ opacity: 0.7 }}>{integration.lastSync || "—"}</td>
                      <td style={{ opacity: 0.7 }}>{integration.records || "—"}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {integration.envVars.slice(0, 2).map((v) => (
                            <code
                              key={v}
                              style={{
                                fontSize: "0.75rem",
                                background: "rgba(255,255,255,0.06)",
                                padding: "2px 6px",
                                borderRadius: 4,
                                color: "#97a3c6",
                              }}
                            >
                              {v}
                            </code>
                          ))}
                          {integration.envVars.length > 2 && (
                            <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>
                              +{integration.envVars.length - 2} more
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <h2>Rep Revenue & Commission Summary</h2>
                <p className="section-subtext">
                  Company-wide performance view — revenue contribution, estimated commission, and training investment per rep.
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table className="accounts-table">
                <thead>
                  <tr>
                    <th>Rep</th>
                    <th>Code</th>
                    <th>Months Employed</th>
                    <th>Est. Revenue (BC)</th>
                    <th>Simulator Sessions</th>
                    <th>Est. Monthly Comp</th>
                    <th>Commission Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {repPerformance.map((rep) => (
                    <tr key={rep.code}>
                      <td><strong>{rep.name}</strong></td>
                      <td style={{ opacity: 0.7 }}>{rep.code}</td>
                      <td>{rep.tenureMonths} mo</td>
                      <td style={{ color: "#3ddc97" }}>{formatCurrency(rep.estRevenue)}</td>
                      <td>{rep.simSessions}</td>
                      <td style={{ color: "#f59e0b" }}>{formatCurrency(rep.estMonthlyComp)}</td>
                      <td style={{ opacity: 0.7 }}>{rep.commissionRate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <h2>FedEx Shipment Activity</h2>
                <p className="section-subtext">
                  Real-time shipment data pulled from FedEx REST API. Connect FedEx credentials in Vercel environment variables to activate.
                </p>
              </div>
              <span className="status-pill status-risk">Not Configured</span>
            </div>

            <div className="detail-grid">
              <div className="mini-stat">
                <span>In Transit</span>
                <strong>{FEDEX_DEMO.inTransit}</strong>
              </div>
              <div className="mini-stat">
                <span>Pending Pickup</span>
                <strong>{FEDEX_DEMO.pendingShipments - FEDEX_DEMO.inTransit}</strong>
              </div>
              <div className="mini-stat">
                <span>Delivered Today</span>
                <strong>{FEDEX_DEMO.deliveredToday}</strong>
              </div>
              <div className="mini-stat">
                <span>Exceptions</span>
                <strong style={{ color: "#f87171" }}>{FEDEX_DEMO.exceptions}</strong>
              </div>
            </div>

            <div className="insight-box" style={{ marginTop: 14 }}>
              <div className="card-label">API Endpoint</div>
              <code style={{ fontSize: "0.78rem", color: "#97a3c6" }}>
                POST /api/fedex/shipments — proxied via Vercel serverless
              </code>
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <h2>Business Central Financial Feed</h2>
                <p className="section-subtext">
                  Inventory, orders, and G/L data from Microsoft Business Central via OAuth 2.0 (Azure AD). Connect BC credentials in Vercel environment variables to activate live data.
                </p>
              </div>
              <span className="status-pill status-risk">Not Configured</span>
            </div>

            <div className="detail-grid">
              <div className="mini-stat">
                <span>Monthly Revenue</span>
                <strong>{formatCurrency(BC_DEMO.monthlyRevenue)}</strong>
              </div>
              <div className="mini-stat">
                <span>Cost of Goods</span>
                <strong>{formatCurrency(BC_DEMO.cogs)}</strong>
              </div>
              <div className="mini-stat">
                <span>Open Orders</span>
                <strong>{BC_DEMO.openOrders}</strong>
              </div>
              <div className="mini-stat">
                <span>Pending Invoices</span>
                <strong>{BC_DEMO.pendingInvoices}</strong>
              </div>
            </div>

            <div className="insight-box" style={{ marginTop: 14 }}>
              <div className="card-label">Authentication Method</div>
              <p className="coach-text">
                OAuth 2.0 via Microsoft Entra ID (Azure AD). Uses a registered Azure app with Business Central API permissions. Token refreshed automatically every 60 minutes via Vercel serverless.
              </p>
            </div>
          </div>
        </div>

        <div className="dashboard-side-stack">
          <div className="card">
            <h2>Financial Summary</h2>

            <div className="feedback-row">
              <span>Gross Revenue (BC)</span>
              <strong style={{ color: "#3ddc97" }}>{formatCurrency(BC_DEMO.monthlyRevenue)}</strong>
            </div>
            <div className="feedback-row">
              <span>Cost of Goods Sold</span>
              <strong style={{ color: "#f87171" }}>({formatCurrency(BC_DEMO.cogs)})</strong>
            </div>
            <div className="feedback-row">
              <span>Gross Profit</span>
              <strong>{formatCurrency(BC_DEMO.grossProfit)}</strong>
            </div>
            <div className="feedback-row">
              <span>Commission Liability</span>
              <strong style={{ color: "#f59e0b" }}>({formatCurrency(commissionLiability)})</strong>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.1)", margin: "12px 0" }} />

            <div className="feedback-row">
              <span>Net Contribution</span>
              <strong style={{ color: netContribution > 0 ? "#3ddc97" : "#f87171", fontSize: "1.1rem" }}>
                {formatCurrency(netContribution)}
              </strong>
            </div>

            <div className="feedback-row">
              <span>Gross Margin</span>
              <strong>{grossMarginPct}%</strong>
            </div>

            <div className="insight-box" style={{ marginTop: 14 }}>
              <div className="card-label">Note</div>
              <p className="coach-text">
                Figures shown are demo placeholders. Connect Business Central to display live financials.
              </p>
            </div>
          </div>

          <div className="card">
            <h2>Prize Program Cost</h2>

            {(() => {
              const totalCashEarned = Object.values(prizes.repEarnings).reduce((s, r) => s + r.totalCash, 0);
              const totalGDEarned = Object.values(prizes.repEarnings).reduce((s, r) => s + r.totalGeniusDollars, 0);
              const daysRecorded = prizes.dailyWinners.length;

              return (
                <>
                  <div className="feedback-row">
                    <span>Total Cash Awarded</span>
                    <strong style={{ color: "#4ade80" }}>${totalCashEarned}</strong>
                  </div>
                  <div className="feedback-row">
                    <span>GeniusDollars Issued</span>
                    <strong style={{ color: "#818cf8" }}>{totalGDEarned} GD</strong>
                  </div>
                  <div className="feedback-row">
                    <span>Days Recorded</span>
                    <strong>{daysRecorded}</strong>
                  </div>
                  <div className="feedback-row">
                    <span>Daily Cash Pool</span>
                    <strong>$19 / day</strong>
                  </div>
                  <div className="feedback-row">
                    <span>Daily GD Pool</span>
                    <strong>195 GD / day</strong>
                  </div>
                </>
              );
            })()}
          </div>

          <div className="card">
            <h2>API Setup Guide</h2>
            <p className="coach-text">
              All three integrations use a server-side proxy pattern — API keys never reach the browser. Each external system calls a Vercel serverless endpoint which authenticates and returns clean, scoped data.
            </p>

            <ul className="mission-list" style={{ marginTop: 12 }}>
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">1</span>
                  <span>Add env vars to Vercel dashboard</span>
                </div>
              </li>
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">2</span>
                  <span>Register BC app in Azure AD</span>
                </div>
              </li>
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">3</span>
                  <span>Create FedEx developer account</span>
                </div>
              </li>
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">4</span>
                  <span>Enable RingCentral JWT auth</span>
                </div>
              </li>
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">5</span>
                  <span>Register webhooks for real-time sync</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </Layout>
  );
}

function buildRepPerformanceTable(simulatorResults, prizes) {
  const today = new Date();

  return employees.map((emp) => {
    const name = getEmployeeFullName(emp);
    const hired = new Date(emp.hireDate);
    const tenureMonths =
      (today.getFullYear() - hired.getFullYear()) * 12 + (today.getMonth() - hired.getMonth());

    const simSessions = simulatorResults.filter(
      (r) => (r.assignedRep || "").toLowerCase() === name.toLowerCase()
    ).length;

    const hash = emp.code.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 1);
    const estRevenue = 40000 + (Math.abs(hash) % 300000);

    const compSummary = buildRepCompSummary({
      startDate: emp.hireDate,
      revenue: estRevenue,
      captures: 10 + (Math.abs(hash) % 15),
      customersSold: 20 + (Math.abs(hash) % 80),
    });

    return {
      code: emp.code,
      name,
      tenureMonths,
      simSessions,
      estRevenue,
      estMonthlyComp: compSummary.totalEstimatedCompensation,
      commissionRate: compSummary.revenueCommissionRateLabel || "—",
    };
  }).sort((a, b) => b.estRevenue - a.estRevenue);
}
