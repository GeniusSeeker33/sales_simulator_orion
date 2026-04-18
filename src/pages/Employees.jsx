import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import {
  employees,
  getEmployeeDisplayName,
  getEmployeeFullName,
  sortEmployeesByHireDate,
} from "../data/employees";

export default function Employees() {
  const navigate = useNavigate();
  const sortedEmployees = useMemo(() => sortEmployeesByHireDate(employees), []);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCode, setSelectedCode] = useState(sortedEmployees[0]?.code ?? null);
  const [sortMode, setSortMode] = useState("hireDateAsc");

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
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
      );
    }

    if (sortMode === "locationAsc") {
      list = [...list].sort((a, b) =>
        `${a.location} ${a.lastName}`.localeCompare(`${b.location} ${b.lastName}`)
      );
    }

    return list;
  }, [searchTerm, sortedEmployees, sortMode]);

  const selectedEmployee = useMemo(() => {
    const fromFiltered =
      filteredEmployees.find((employee) => employee.code === selectedCode) ?? null;

    if (fromFiltered) return fromFiltered;

    return filteredEmployees[0] ?? null;
  }, [filteredEmployees, selectedCode]);

  const locationCounts = useMemo(() => {
    return employees.reduce((acc, employee) => {
      const location = employee.location || "Unknown";
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    }, {});
  }, []);

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
            </div>

            <div className="detail-grid" style={{ marginBottom: 16 }}>
              <div className="mini-stat">
                <span>Total Employees</span>
                <strong>{employees.length}</strong>
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
                  {(locationCounts["Remote-NH"] ?? 0) + (locationCounts["Remote SC"] ?? 0)}
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

              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
              >
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
                      className={selectedEmployee?.code === employee.code ? "row-active" : ""}
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
                  <strong>{selectedEmployee.phone}</strong>
                </div>

                <div className="feedback-row">
                  <span>Email</span>
                  <strong>{selectedEmployee.email}</strong>
                </div>

                <div className="feedback-row">
                  <span>Employee Code</span>
                  <strong>{selectedEmployee.code}</strong>
                </div>
              </div>

              <div className="card">
                <h2>Readiness Profile</h2>

                <div className="feedback-row">
                  <span>Current Tenure Month</span>
                  <strong>{calculateTenureMonths(selectedEmployee.hireDate)}</strong>
                </div>

                <div className="feedback-row">
                  <span>Comp Plan Eligibility</span>
                  <strong>
                    {calculateTenureMonths(selectedEmployee.hireDate) <= 12
                      ? "Year 1 — $31,200 base"
                      : "Year 2+ — $25,000 base"}
                  </strong>
                </div>

                <div className="feedback-row">
                  <span>Hire Date</span>
                  <strong>{selectedEmployee.hireDate}</strong>
                </div>

                <p className="coach-text">
                  Load this employee into Compensation Inputs to model their KPI
                  qualification and estimated monthly pay using their actual start date.
                </p>

                <div className="button-row">
                  <button
                    className="btn-primary"
                    onClick={() =>
                      navigate("/rep-metrics", {
                        state: {
                          repName: getEmployeeFullName(selectedEmployee),
                          startDate: selectedEmployee.hireDate,
                        },
                      })
                    }
                  >
                    Load into Rep Metrics
                  </button>
                </div>
              </div>
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