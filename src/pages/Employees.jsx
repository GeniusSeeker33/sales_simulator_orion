import { useEffect, useMemo, useState } from "react";
import Layout from "../components/layout/Layout";
import {
  employees as staticEmployees,
  getEmployeeDisplayName,
  getEmployeeFullName,
  sortEmployeesByHireDate,
} from "../data/employees";
import { useAuth } from "../context/AuthContext";
import ReferralModal from "../components/ReferralModal";
import { buildRepCompSummary, formatCurrency } from "../lib/compEngine";
import { loadSimulatorResults } from "../lib/simulatorResultsStore";

export default function Employees() {
  const { session } = useAuth();
  const [apiEmployees, setApiEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCode, setSelectedCode] = useState(null);
  const [sortMode, setSortMode] = useState("hireDateAsc");
  const [referralOpen, setReferralOpen] = useState(false);

  useEffect(() => {
    fetch("/api/employees/list")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.employees) && data.employees.length > 0) {
          setApiEmployees(data.employees);
          setSelectedCode(data.employees[0]?.code ?? null);
        }
      })
      .catch((err) => {
        console.warn("Using static employee data. API not loaded:", err);
      });
  }, []);

  const sourceEmployees = apiEmployees.length > 0 ? apiEmployees : staticEmployees;

  const sortedEmployees = useMemo(
    () => sortEmployeesByHireDate(sourceEmployees),
    [sourceEmployees]
  );

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    let list = sortedEmployees.filter((employee) => {
      if (!normalizedSearch) return true;

      const haystack = [
        employee.firstName,
        employee.lastName,
        employee.preferredName,
        employee.email,
        employee.code,
        employee.location,
        getEmployeeFullName(employee),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });

    if (sortMode === "hireDateAsc") {
      list = [...list].sort(
        (a, b) => new Date(a.hireDate).getTime() - new Date(b.hireDate).getTime()
      );
    }

    if (sortMode === "hireDateDesc") {
      list = [...list].sort(
        (a, b) => new Date(b.hireDate).getTime() - new Date(a.hireDate).getTime()
      );
    }

    if (sortMode === "lastNameAsc") {
      list = [...list].sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(
          `${b.lastName} ${b.firstName}`
        )
      );
    }

    if (sortMode === "locationAsc") {
      list = [...list].sort((a, b) =>
        `${a.location} ${a.lastName}`.localeCompare(
          `${b.location} ${b.lastName}`
        )
      );
    }

    return list;
  }, [searchTerm, sortedEmployees, sortMode]);

  const selectedEmployee = useMemo(() => {
    return (
      filteredEmployees.find((employee) => employee.code === selectedCode) ||
      filteredEmployees[0] ||
      null
    );
  }, [filteredEmployees, selectedCode]);

  const locationCounts = useMemo(() => {
    return sourceEmployees.reduce((acc, employee) => {
      const location = employee.location || "Unknown";
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    }, {});
  }, [sourceEmployees]);

  const repStats = useMemo(() => {
    if (!selectedEmployee) return null;
    const simulatorResults = loadSimulatorResults();
    const name = getEmployeeFullName(selectedEmployee);
    const simSessions = simulatorResults.filter(
      (r) => (r.assignedRep || "").toLowerCase() === name.toLowerCase()
    );
    const avgScore = simSessions.length
      ? Math.round(simSessions.reduce((s, r) => s + (r.score ?? 0), 0) / simSessions.length)
      : null;

    const hash = selectedEmployee.code.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 1);
    const estRevenue = 40000 + (Math.abs(hash) % 300000);
    const estCaptures = 10 + (Math.abs(hash) % 15);
    const estCustomersSold = 20 + (Math.abs(hash) % 80);

    const comp = buildRepCompSummary({
      startDate: selectedEmployee.hireDate,
      revenue: estRevenue,
      captures: estCaptures,
      customersSold: estCustomersSold,
    });

    return { comp, simSessions: simSessions.length, avgScore, estRevenue, estCaptures, estCustomersSold };
  }, [selectedEmployee]);

  return (
    <Layout title="Employees">
      <section className="dashboard-main-grid">
        <div className="dashboard-main-stack">
          <div className="card">
            <div className="section-header">
              <div>
                <h2>Employee Roster</h2>
                <p className="section-subtext">
                  Orion employee directory with tenure, location, code, and contact details.
                </p>
              </div>
              <button className="btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => setReferralOpen(true)}>
                + Refer a Candidate
              </button>
            </div>

            <ReferralModal
              isOpen={referralOpen}
              onClose={() => setReferralOpen(false)}
              submitterEmail={session?.email}
              submitterName={session?.name}
            />

            <div className="detail-grid" style={{ marginBottom: 16 }}>
              <div className="mini-stat">
                <span>Total Employees</span>
                <strong>{sourceEmployees.length}</strong>
              </div>

              <div className="mini-stat">
                <span>Indiana</span>
                <strong>{locationCounts["IN"] ?? 0}</strong>
              </div>

              <div className="mini-stat">
                <span>Michigan</span>
                <strong>{locationCounts["MI"] ?? 0}</strong>
              </div>

              <div className="mini-stat">
                <span>Remote</span>
                <strong>
                  {(locationCounts["Remote-NH"] ?? 0) +
                    (locationCounts["Remote SC"] ?? 0)}
                </strong>
              </div>
            </div>

            <div
              className="button-row"
              style={{ marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}
            >
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, code, email, or location"
                style={{ minWidth: 280 }}
              />

              <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
                <option value="hireDateAsc">Hire Date: Oldest First</option>
                <option value="hireDateDesc">Hire Date: Newest First</option>
                <option value="lastNameAsc">Last Name: A-Z</option>
                <option value="locationAsc">Location</option>
              </select>
            </div>

            <div className="table-wrap">
              <table className="accounts-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Preferred</th>
                    <th>Code</th>
                    <th>Location</th>
                    <th>Hire Date</th>
                    <th>Tenure</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr
                      key={employee.code}
                      className={
                        selectedEmployee?.code === employee.code ? "row-active" : ""
                      }
                      onClick={() => setSelectedCode(employee.code)}
                    >
                      <td>{getEmployeeFullName(employee)}</td>
                      <td>{getEmployeeDisplayName(employee)}</td>
                      <td>{employee.code}</td>
                      <td>{employee.location}</td>
                      <td>{formatDate(employee.hireDate)}</td>
                      <td>{getTenureLabel(employee.hireDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredEmployees.length === 0 && (
              <p className="coach-text" style={{ marginTop: 16 }}>
                No employees matched your search.
              </p>
            )}
          </div>
        </div>

        <div className="dashboard-side-stack">
          {selectedEmployee ? (
            <>
              <div className="card">
                <div className="section-header">
                  <div>
                    <h2>{getEmployeeFullName(selectedEmployee)}</h2>
                    <p className="section-subtext">
                      {selectedEmployee.preferredName
                        ? `Preferred: ${selectedEmployee.preferredName}`
                        : "No preferred name listed"}
                    </p>
                  </div>

                  <span className="status-pill status-neutral">
                    {selectedEmployee.code}
                  </span>
                </div>

                <div className="feedback-row">
                  <span>Location</span>
                  <strong>{selectedEmployee.location}</strong>
                </div>

                <div className="feedback-row">
                  <span>Hire Date</span>
                  <strong>{formatDate(selectedEmployee.hireDate)}</strong>
                </div>

                <div className="feedback-row">
                  <span>Tenure Month</span>
                  <strong>{calculateTenureMonths(selectedEmployee.hireDate)}</strong>
                </div>

                <div className="feedback-row">
                  <span>Tenure</span>
                  <strong>{getTenureLabel(selectedEmployee.hireDate)}</strong>
                </div>
              </div>

              <div className="card">
                <h2>Contact Info</h2>

                <div className="feedback-row">
                  <span>Phone</span>
                  <strong>{selectedEmployee.phone || "—"}</strong>
                </div>

                <div className="feedback-row">
                  <span>Email</span>
                  <strong>{selectedEmployee.email || "—"}</strong>
                </div>

                <div className="feedback-row">
                  <span>Employee Code</span>
                  <strong>{selectedEmployee.code}</strong>
                </div>
              </div>

              {repStats && (
                <div className="card">
                  <div className="section-header" style={{ marginBottom: 12 }}>
                    <div>
                      <h2>Comp Plan Status</h2>
                      <p className="section-subtext">Based on hire date and tenure-mapped KPI targets</p>
                    </div>
                    {repStats.comp.kpiMeasurementActive ? (
                      repStats.comp.hitAllKpis
                        ? <span className="status-pill status-positive">On Track</span>
                        : <span className="status-pill status-risk">At Risk</span>
                    ) : (
                      <span className="status-pill status-neutral">Ramp Period</span>
                    )}
                  </div>

                  <div className="feedback-row">
                    <span>Employment Month</span>
                    <strong>{repStats.comp.employmentMonth}</strong>
                  </div>

                  <div className="feedback-row">
                    <span>KPI Measurement</span>
                    <strong>
                      {repStats.comp.kpiMeasurementActive
                        ? `Active — Month ${repStats.comp.measuredMonth}`
                        : "In Ramp Period (first 4 weeks)"}
                    </strong>
                  </div>

                  <div className="feedback-row">
                    <span>Commission Rate</span>
                    <strong>{repStats.comp.revenueCommissionRateLabel}</strong>
                  </div>

                  <div className="feedback-row">
                    <span>Est. Monthly Comp</span>
                    <strong style={{ color: "#f59e0b" }}>
                      {formatCurrency(repStats.comp.totalEstimatedCompensation)}
                    </strong>
                  </div>

                  {repStats.comp.kpiMeasurementActive && (
                    <>
                      <div style={{ marginTop: 14, marginBottom: 6 }}>
                        <div className="card-label">KPI Targets — Month {repStats.comp.measuredMonth}</div>
                      </div>

                      <div className="feedback-row">
                        <span>Revenue Target</span>
                        <strong style={{ color: repStats.comp.hitRevenue ? "#3ddc97" : "#f87171" }}>
                          {formatCurrency(repStats.comp.kpiTargets.minimumRevenue)}
                          {" "}<span style={{ opacity: 0.6, fontSize: "0.8rem" }}>{repStats.comp.hitRevenue ? "✓" : "✗"}</span>
                        </strong>
                      </div>

                      <div className="feedback-row">
                        <span>Captures Target</span>
                        <strong style={{ color: repStats.comp.hitCaptures ? "#3ddc97" : "#f87171" }}>
                          {repStats.comp.kpiTargets.minimumCaptures} new accounts
                          {" "}<span style={{ opacity: 0.6, fontSize: "0.8rem" }}>{repStats.comp.hitCaptures ? "✓" : "✗"}</span>
                        </strong>
                      </div>

                      <div className="feedback-row">
                        <span>Customers Sold Target</span>
                        <strong style={{ color: repStats.comp.hitCustomersSold ? "#3ddc97" : "#f87171" }}>
                          {repStats.comp.kpiTargets.minimumCustomersSold} customers
                          {" "}<span style={{ opacity: 0.6, fontSize: "0.8rem" }}>{repStats.comp.hitCustomersSold ? "✓" : "✗"}</span>
                        </strong>
                      </div>
                    </>
                  )}
                </div>
              )}

              {repStats && (
                <div className="card">
                  <h2>Simulator Training</h2>

                  <div className="feedback-row">
                    <span>Sessions Completed</span>
                    <strong>{repStats.simSessions}</strong>
                  </div>

                  <div className="feedback-row">
                    <span>Average Score</span>
                    <strong>
                      {repStats.avgScore !== null ? `${repStats.avgScore}%` : "—"}
                    </strong>
                  </div>

                  {repStats.simSessions === 0 && (
                    <p className="coach-text" style={{ marginTop: 10 }}>
                      No simulator sessions recorded yet. Sessions appear once this rep completes an AI Sales Simulator run.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="card">
              <h2>No Employee Selected</h2>
              <p className="section-subtext">
                Select an employee from the roster to view details.
              </p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

function calculateTenureMonths(hireDate) {
  if (!hireDate) return 0;

  const start = new Date(hireDate);
  const now = new Date();

  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());

  if (now.getDate() < start.getDate()) {
    months -= 1;
  }

  return Math.max(months + 1, 1);
}

function getTenureLabel(hireDate) {
  const tenureMonths = calculateTenureMonths(hireDate);

  if (tenureMonths < 12) {
    return `${tenureMonths} month${tenureMonths === 1 ? "" : "s"}`;
  }

  const years = Math.floor(tenureMonths / 12);
  const months = tenureMonths % 12;

  if (months === 0) {
    return `${years} year${years === 1 ? "" : "s"}`;
  }

  return `${years} year${years === 1 ? "" : "s"}, ${months} month${
    months === 1 ? "" : "s"
  }`;
}

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return value;
  }
}