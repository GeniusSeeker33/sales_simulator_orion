import { useState, useEffect } from "react";
import { fetchBalance, submitRedemption } from "../lib/geniusDollars";

const REWARDS = [
  { label: "Team Pizza Party", cost: 2500, description: "Up to 10 people. Desiree coordinates." },
  { label: "Studio Session — 2 Hours", cost: 5000, description: "Recording time at Earthtone Analog." },
  { label: "Studio Session — Half Day", cost: 9000, description: "4-hour block at Earthtone Analog." },
  { label: "Private Event — Cookout", cost: 15000, description: "Up to 20 guests at Earthtone." },
  { label: "Private Event — Live Music Night", cost: 20000, description: "Live music, up to 30 guests." },
  { label: "Private Event — Target Practice Demo", cost: 12000, description: "Up to 15 guests." },
];

export default function GeniusDollarsWidget({ email }) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [selectedReward, setSelectedReward] = useState(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!email) return;
    fetchBalance(email).then((data) => {
      setBalance(data);
      setLoading(false);
    });
  }, [email]);

  async function handleRedeem() {
    if (!selectedReward || !email) return;
    setRedeeming(true);
    setStatus(null);
    try {
      const result = await submitRedemption({
        actor: email,
        reward: selectedReward.label,
        cost: selectedReward.cost,
        notes,
      });
      setStatus({ ok: true, message: `Request submitted! New balance: ${result.newBalance} GD` });
      setBalance((prev) => prev ? { ...prev, balance: result.newBalance } : prev);
      setSelectedReward(null);
      setNotes("");
    } catch (err) {
      setStatus({ ok: false, message: err.message });
    } finally {
      setRedeeming(false);
    }
  }

  if (!email) return null;

  return (
    <div className="gd-widget">
      <div className="gd-widget-header">
        <span className="gd-coin-icon">⬡</span>
        <div>
          <h3>GeniusDollars</h3>
          <p className="gd-sub">Earn by training. Redeem for real experiences.</p>
        </div>
      </div>

      {loading ? (
        <p className="gd-loading">Loading balance...</p>
      ) : balance === null ? (
        <p className="gd-loading">Balance unavailable — identity service offline.</p>
      ) : (
        <>
          <div className="gd-balance-row">
            <div className="gd-balance-card">
              <span>Available</span>
              <strong>{balance.balance?.toLocaleString() ?? 0} GD</strong>
            </div>
            <div className="gd-balance-card">
              <span>Total Earned</span>
              <strong>{balance.earned?.toLocaleString() ?? 0} GD</strong>
            </div>
            <div className="gd-balance-card">
              <span>Redeemed</span>
              <strong>{balance.redeemed?.toLocaleString() ?? 0} GD</strong>
            </div>
          </div>

          <h4 className="gd-rewards-title">Redeem Your GeniusDollars</h4>
          <div className="gd-rewards-list">
            {REWARDS.map((r) => {
              const canAfford = (balance.balance ?? 0) >= r.cost;
              const isSelected = selectedReward?.label === r.label;
              return (
                <button
                  key={r.label}
                  className={`gd-reward-card ${isSelected ? "selected" : ""} ${!canAfford ? "locked" : ""}`}
                  onClick={() => canAfford && setSelectedReward(isSelected ? null : r)}
                  disabled={!canAfford}
                >
                  <div className="gd-reward-top">
                    <span className="gd-reward-label">{r.label}</span>
                    <span className="gd-reward-cost">{r.cost.toLocaleString()} GD</span>
                  </div>
                  <p className="gd-reward-desc">{r.description}</p>
                  {!canAfford && (
                    <p className="gd-reward-locked">Need {(r.cost - (balance.balance ?? 0)).toLocaleString()} more GD</p>
                  )}
                </button>
              );
            })}
          </div>

          {selectedReward && (
            <div className="gd-redeem-form">
              <p><strong>Redeeming:</strong> {selectedReward.label} ({selectedReward.cost.toLocaleString()} GD)</p>
              <textarea
                className="gd-notes-input"
                placeholder="Optional: dates that work, number of guests, any requests..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
              <button
                className="btn-primary"
                onClick={handleRedeem}
                disabled={redeeming}
              >
                {redeeming ? "Submitting..." : "Submit Redemption Request"}
              </button>
            </div>
          )}

          {status && (
            <p className={`gd-status ${status.ok ? "ok" : "error"}`}>{status.message}</p>
          )}
        </>
      )}
    </div>
  );
}
