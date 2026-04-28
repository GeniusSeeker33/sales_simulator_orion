import { useState } from "react";
import { createReferral } from "../lib/referralStore";

const POSITIONS = [
  "Sales Executive",
  "Sales Manager",
  "Operations",
  "Customer Service",
  "Warehouse / Logistics",
  "Other",
];

export default function ReferralModal({ isOpen, onClose, submitterEmail, submitterName }) {
  const [form, setForm] = useState({
    candidateName: "",
    candidateEmail: "",
    candidatePhone: "",
    relationship: "",
    positionInterest: "Sales Executive",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit() {
    if (!form.candidateName.trim()) { setError("Candidate name is required."); return; }
    setError("");
    createReferral({
      submittedBy: submitterEmail,
      submittedByName: submitterName,
      ...form,
    });
    setSubmitted(true);
  }

  function handleClose() {
    setForm({ candidateName: "", candidateEmail: "", candidatePhone: "", relationship: "", positionInterest: "Sales Executive" });
    setSubmitted(false);
    setError("");
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Refer a Candidate</h2>
            <p className="gd-sub">$100 when they start · $150 after 90 days</p>
          </div>
          <button className="modal-close-btn" onClick={handleClose}>✕</button>
        </div>

        {submitted ? (
          <div className="referral-success">
            <div className="referral-success-icon">🎉</div>
            <h3>Referral Submitted!</h3>
            <p>We'll reach out to <strong>{form.candidateName}</strong> and keep you posted on their status.</p>
            <p className="gd-sub">You'll earn <strong style={{ color: "#3ddc97" }}>$100</strong> when they start and another <strong style={{ color: "#c9a84c" }}>$150</strong> after 90 days.</p>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={handleClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="referral-form">
              <div className="referral-form-row">
                <label className="referral-label">Candidate Name <span className="referral-required">*</span></label>
                <input
                  className="referral-input"
                  type="text"
                  placeholder="Full name"
                  value={form.candidateName}
                  onChange={(e) => set("candidateName", e.target.value)}
                />
              </div>

              <div className="referral-form-row two-col">
                <div>
                  <label className="referral-label">Email</label>
                  <input
                    className="referral-input"
                    type="email"
                    placeholder="candidate@email.com"
                    value={form.candidateEmail}
                    onChange={(e) => set("candidateEmail", e.target.value)}
                  />
                </div>
                <div>
                  <label className="referral-label">Phone</label>
                  <input
                    className="referral-input"
                    type="tel"
                    placeholder="555-000-0000"
                    value={form.candidatePhone}
                    onChange={(e) => set("candidatePhone", e.target.value)}
                  />
                </div>
              </div>

              <div className="referral-form-row">
                <label className="referral-label">Your Relationship</label>
                <input
                  className="referral-input"
                  type="text"
                  placeholder="e.g. Former colleague, friend, former customer..."
                  value={form.relationship}
                  onChange={(e) => set("relationship", e.target.value)}
                />
              </div>

              <div className="referral-form-row">
                <label className="referral-label">Position Interest</label>
                <select
                  className="referral-input"
                  value={form.positionInterest}
                  onChange={(e) => set("positionInterest", e.target.value)}
                >
                  {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="referral-bonus-strip">
              <div className="referral-bonus-item">
                <span className="referral-bonus-amount" style={{ color: "#3ddc97" }}>$100</span>
                <span className="referral-bonus-label">When they start</span>
              </div>
              <div className="referral-bonus-divider" />
              <div className="referral-bonus-item">
                <span className="referral-bonus-amount" style={{ color: "#c9a84c" }}>$150</span>
                <span className="referral-bonus-label">After 90 days</span>
              </div>
              <div className="referral-bonus-divider" />
              <div className="referral-bonus-item">
                <span className="referral-bonus-amount" style={{ color: "#818cf8" }}>$250</span>
                <span className="referral-bonus-label">Total per hire</span>
              </div>
            </div>

            {error && <p className="gd-status error" style={{ marginBottom: 0 }}>{error}</p>}

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleSubmit}>Submit Referral</button>
              <button className="btn-secondary" onClick={handleClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
