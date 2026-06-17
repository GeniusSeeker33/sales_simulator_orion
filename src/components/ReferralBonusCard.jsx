import { useState } from "react";
import ReferralModal from "./ReferralModal";
import {
  getReferralsByEmail,
  calcPendingBonuses,
  STATUS_LABELS,
} from "../lib/referralStore";

export default function ReferralBonusCard({ session, variant = "dashboard" }) {
  const [referralOpen, setReferralOpen] = useState(false);

  const myReferrals = session?.email ? getReferralsByEmail(session.email) : [];
  const pendingBonus = calcPendingBonuses(myReferrals);

  return (
    <>
      <div className={`referral-card ${variant === "newsletter" ? "referral-card-newsletter" : ""}`}>
        <div className="referral-card-left">
          <h3>Refer &amp; Earn</h3>
          <p className="gd-sub">Know someone great? Send them our way.</p>

          <div className="referral-card-bonuses">
            <span className="referral-pill green">$100 when they start</span>
            <span className="referral-pill gold">$150 after 90 days</span>
            <span className="referral-pill purple">$250 total</span>
          </div>

          {myReferrals.length > 0 && (
            <div className="referral-card-history">
              {myReferrals.slice(0, 3).map((r) => (
                <div key={r.id} className="referral-card-row">
                  <span>{r.candidateName}</span>
                  <span
                    className="referral-status-dot"
                    style={{ color: STATUS_LABELS[r.status]?.color }}
                  >
                    {STATUS_LABELS[r.status]?.label || r.status}
                  </span>
                </div>
              ))}

              {pendingBonus > 0 && (
                <p className="referral-card-earned">
                  Earned so far:{" "}
                  <strong style={{ color: "#3ddc97" }}>${pendingBonus}</strong>
                </p>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn-primary referral-card-btn"
            onClick={() => setReferralOpen(true)}
          >
            Refer Someone
          </button>

          <a
            href="https://join-orion.com/careers"
            target="_blank"
            rel="noreferrer"
            className="btn-secondary referral-card-btn"
            style={{ textDecoration: "none" }}
          >
            View Careers
          </a>
        </div>
      </div>

      <ReferralModal
        isOpen={referralOpen}
        onClose={() => setReferralOpen(false)}
        submitterEmail={session?.email}
        submitterName={session?.name}
      />
    </>
  );
}