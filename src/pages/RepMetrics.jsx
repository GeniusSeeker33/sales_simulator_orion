import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import Layout from "../components/layout/Layout";
import { useToast } from "../context/ToastContext";
import {
  buildRepCompSummary,
  buildCompOpportunitySummary,
  buildKpiStatusMessage,
  formatCurrency,
} from "../lib/compEngine";
import {
  loadRepProfile,
  saveRepProfile,
  resetRepProfile,
  getTodayDateString,
} from "../lib/repProfileStore";

export default function RepMetrics() {
  const location = useLocation();
  const [form, setForm] = useState(() => {
    const saved = loadRepProfile();
    const incoming = location.state;
    if (incoming?.repName || incoming?.startDate) {
      return {
        ...saved,
        repName: incoming.repName ?? saved.repName,
        startDate: incoming.startDate ?? saved.startDate,
      };
    }
    return saved;
  });
  const [savedMessage, setSavedMessage] = useState(
    location.state?.repName ? `Loaded profile for ${location.state.repName}. Adjust metrics and save.` : ""
  );
  const todayStr = getTodayDateString();
  const toast = useToast();

  const summary = useMemo(() => {
    return buildRepCompSummary({
      startDate: form.startDate,
      revenue: Number(form.revenue || 0),
      captures: Number(form.captures || 0),
      customersSold: Number(form.customersSold || 0),
    });
  }, [form]);

  const opportunity = useMemo(() => {
    return buildCompOpportunitySummary({
      startDate: form.startDate,
      revenue: Number(form.revenue || 0),
      captures: Number(form.captures || 0),
      customersSold: Number(form.customersSold || 0),
    });
  }, [form]);

  const statusMessage = useMemo(() => {
    return buildKpiStatusMessage({
      startDate: form.startDate,
      revenue: Number(form.revenue || 0),
      captures: Number(form.captures || 0),
      customersSold: Number(form.customersSold || 0),
    });
  }, [form]);

  function handleChange(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSavedMessage("");
  }

  function handleSave() {
    const saved = saveRepProfile(form);
    setForm(saved);
    setSavedMessage("");
    toast("Rep metrics saved. Dashboard compensation is now updated.");
  }

  function handleReset() {
    const reset = resetRepProfile();
    setForm(reset);
    setSavedMessage("");
    toast("Metrics reset to demo values.", { type: "info" });
  }

  return (
    <Layout title="Rep Metrics">
      <section className="dashboard-main-grid">
        <div className="dashboard-main-stack">
          <div className="card">
            <div className="section-header">
              <div>
                <h2>Rep Metrics Input</h2>
                <p className="section-subtext">
                  Enter the monthly numbers used to calculate compensation and KPI qualification.
                </p>
              </div>
            </div>

            <div className="plan-editor">
              <label className="form-field">
                <span>Rep Name</span>
                <input
                  type="text"
                  value={form.repName}
                  onChange={(e) => handleChange("repName", e.target.value)}
                />
              </label>

              <label className="form-field">
                <span>Start Date</span>
                <input
                  type="date"
                  value={form.startDate}
                  max={todayStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && val > todayStr) return;
                    handleChange("startDate", val);
                  }}
                />
                {form.startDate > todayStr && (
                  <span className="field-error">Start date cannot be in the future.</span>
                )}
              </label>

              <label className="form-field">
                <span>Revenue</span>
                <input
                  type="number"
                  min="0"
                  max="10000000"
                  step="0.01"
                  value={form.revenue}
                  onChange={(e) => handleChange("revenue", e.target.value)}
                />
                {Number(form.revenue) < 0 && (
                  <span className="field-error">Revenue cannot be negative.</span>
                )}
                {Number(form.revenue) > 10000000 && (
                  <span className="field-error">Revenue exceeds maximum allowed ($10,000,000).</span>
                )}
              </label>

              <label className="form-field">
                <span>Captures</span>
                <input
                  type="number"
                  min="0"
                  max="9999"
                  step="1"
                  value={form.captures}
                  onChange={(e) => handleChange("captures", e.target.value)}
                />
                {Number(form.captures) < 0 && (
                  <span className="field-error">Captures cannot be negative.</span>
                )}
              </label>

              <label className="form-field">
                <span>Customers Sold</span>
                <input
                  type="number"
                  min="0"
                  max="9999"
                  step="1"
                  value={form.customersSold}
                  onChange={(e) => handleChange("customersSold", e.target.value)}
                />
                {Number(form.customersSold) < 0 && (
                  <span className="field-error">Customers Sold cannot be negative.</span>
                )}
              </label>

              <div className="button-row">
                <button className="btn-primary" onClick={handleSave}>
                  Save Metrics
                </button>
                <button className="btn-secondary" onClick={handleReset}>
                  Reset Demo Values
                </button>
              </div>

              {savedMessage ? <p className="coach-text" style={{ color: "#93c5fd" }}>{savedMessage}</p> : null}
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <h2>Employment & KPI Timing</h2>
                <p className="section-subtext">
                  KPI measurement starts only after the first 4 weeks of employment.
                </p>
              </div>

              <span
                className={`status-pill ${
                  summary.kpiMeasurementActive ? "status-positive" : "status-neutral"
                }`}
              >
                {summary.kpiMeasurementActive ? "KPI Active" : "Ramp Buffer"}
              </span>
            </div>

            <div className="detail-grid">
              <div className="mini-stat">
                <span>Days Employed</span>
                <strong>{summary.daysEmployed}</strong>
              </div>

              <div className="mini-stat">
                <span>Employment Month</span>
                <strong>{summary.employmentMonth}</strong>
              </div>

              <div className="mini-stat">
                <span>Measured KPI Month</span>
                <strong>
                  {summary.kpiMeasurementActive ? summary.measuredMonth : "Not active"}
                </strong>
              </div>

              <div className="mini-stat">
                <span>Capture Goal</span>
                <strong>
                  {summary.kpiTargets.minimumCaptures == null
                    ? "Not set"
                    : summary.kpiTargets.minimumCaptures}
                </strong>
              </div>
            </div>

            <p className="coach-text">{statusMessage}</p>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <h2>KPI Qualification</h2>
                <p className="section-subtext">
                  Live evaluation against the measured monthly KPI thresholds.
                </p>
              </div>

              <span
                className={`status-pill ${
                  summary.kpiMeasurementActive
                    ? summary.hitAllKpis
                      ? "status-positive"
                      : "status-risk"
                    : "status-neutral"
                }`}
              >
                {summary.kpiMeasurementActive
                  ? summary.hitAllKpis
                    ? "Qualified"
                    : "Not Qualified"
                  : "Not Measured Yet"}
              </span>
            </div>

            <div className="detail-grid">
              <div className="mini-stat">
                <span>Revenue Target</span>
                <strong>
                  {summary.kpiTargets.minimumRevenue == null
                    ? "Not set"
                    : formatCurrency(summary.kpiTargets.minimumRevenue)}
                </strong>
              </div>

              <div className="mini-stat">
                <span>Capture Target</span>
                <strong>
                  {summary.kpiTargets.minimumCaptures == null
                    ? "Not set"
                    : summary.kpiTargets.minimumCaptures}
                </strong>
              </div>

              <div className="mini-stat">
                <span>Customers Sold Target</span>
                <strong>
                  {summary.kpiTargets.minimumCustomersSold == null
                    ? "Not set"
                    : summary.kpiTargets.minimumCustomersSold}
                </strong>
              </div>

              <div className="mini-stat">
                <span>Commission Rate</span>
                <strong>{summary.revenueCommissionRateLabel}</strong>
              </div>
            </div>

            <p className="coach-text">{statusMessage}</p>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <h2>Compensation Preview</h2>
                <p className="section-subtext">
                  Estimated pay breakdown for the current monthly inputs.
                </p>
              </div>
            </div>

            <div className="feedback-row">
              <span>Hourly Compensation</span>
              <strong>{formatCurrency(summary.hourlyCompensation)}</strong>
            </div>

            <div className="feedback-row">
              <span>Revenue Commission</span>
              <strong>{formatCurrency(summary.revenueCommission)}</strong>
            </div>

            <div className="feedback-row">
              <span>Capture Bonus</span>
              <strong>{formatCurrency(summary.captureBonus)}</strong>
            </div>

            <div className="feedback-row">
              <span>Customer Sold Bonus</span>
              <strong>{formatCurrency(summary.customerSoldBonus)}</strong>
            </div>

            <div className="feedback-row">
              <span>Total Estimated Compensation</span>
              <strong>{formatCurrency(summary.totalEstimatedCompensation)}</strong>
            </div>
          </div>
        </div>

        <div className="dashboard-side-stack">
          <div className="card">
            <h2>Missed Upside</h2>

            <div className="feedback-row">
              <span>Potential Additional Pay</span>
              <strong>{formatCurrency(opportunity.missedCompensation)}</strong>
            </div>

            <div className="feedback-row">
              <span>Commission Delta</span>
              <strong>{formatCurrency(opportunity.missedCommissionOnly)}</strong>
            </div>

            <p className="coach-text">
              {!summary.kpiMeasurementActive
                ? "This rep is still in the first 4 weeks, so KPI qualification has not started yet."
                : summary.hitAllKpis
                ? "All KPI gates are currently met. This rep is already in the accelerated tier."
                : "This estimates how much more the rep could earn by qualifying for the accelerated commission structure."}
            </p>
          </div>

          <div className="card">
            <h2>KPI Misses</h2>

            <div className="feedback-row">
              <span>Revenue</span>
              <strong>
                {summary.kpiMeasurementActive
                  ? summary.hitRevenue
                    ? "Hit"
                    : "Missed"
                  : "Not Active"}
              </strong>
            </div>

            <div className="feedback-row">
              <span>Captures</span>
              <strong>
                {summary.kpiMeasurementActive
                  ? summary.hitCaptures
                    ? "Hit"
                    : "Missed"
                  : "Not Active"}
              </strong>
            </div>

            <div className="feedback-row">
              <span>Customers Sold</span>
              <strong>
                {summary.kpiMeasurementActive
                  ? summary.hitCustomersSold
                    ? "Hit"
                    : "Missed"
                  : "Not Active"}
              </strong>
            </div>
          </div>

          <div className="card">
            <h2>Leadership View</h2>

            <div className="feedback-row">
              <span>Rep</span>
              <strong>{form.repName || "AE User"}</strong>
            </div>

            <div className="feedback-row">
              <span>Start Date</span>
              <strong>{form.startDate || "—"}</strong>
            </div>

            <div className="feedback-row">
              <span>Status</span>
              <strong>
                {!summary.kpiMeasurementActive
                  ? "Ramp Buffer"
                  : summary.hitAllKpis
                  ? "Accelerated"
                  : "Base"}
              </strong>
            </div>

            <div className="feedback-row">
              <span>Total Comp</span>
              <strong>{formatCurrency(summary.totalEstimatedCompensation)}</strong>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}