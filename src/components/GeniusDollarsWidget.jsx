import { useState, useEffect } from "react";
import { fetchBalance, submitRedemption } from "../lib/geniusDollars";
import {
  loadPools, createPool, addOrUpdatePledge, removePledge,
  markPoolRedeemed, deletePool, getPoolTotal,
} from "../lib/poolStore";

const REWARDS = [
  { label: "Team Pizza Party", cost: 2500, description: "Up to 10 people. Desiree coordinates." },
  { label: "Studio Session — 2 Hours", cost: 5000, description: "Recording time at Earthtone Analog." },
  { label: "Studio Session — Half Day", cost: 9000, description: "4-hour block at Earthtone Analog." },
  { label: "Private Event — Cookout", cost: 15000, description: "Up to 20 guests at Earthtone." },
  { label: "Private Event — Live Music Night", cost: 20000, description: "Live music, up to 30 guests." },
  { label: "Private Event — Target Practice Demo", cost: 12000, description: "Up to 15 guests." },
];

export default function GeniusDollarsWidget({ email, name }) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [selectedReward, setSelectedReward] = useState(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState(null);

  const [pools, setPools] = useState([]);
  const [showNewPool, setShowNewPool] = useState(false);
  const [newPoolReward, setNewPoolReward] = useState(REWARDS[0]);
  const [newPoolPledge, setNewPoolPledge] = useState("");
  const [newPoolNote, setNewPoolNote] = useState("");
  const [pledgingPoolId, setPledgingPoolId] = useState(null);
  const [pledgeAmount, setPledgeAmount] = useState("");
  const [poolStatus, setPoolStatus] = useState(null);

  useEffect(() => {
    if (!email) return;
    fetchBalance(email).then((data) => {
      setBalance(data);
      setLoading(false);
    });
    setPools(loadPools().pools);
  }, [email]);

  function refreshPools() {
    setPools(loadPools().pools);
  }

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

  function handleCreatePool() {
    if (!email || !name) return;
    const pledge = parseInt(newPoolPledge, 10);
    createPool({
      rewardLabel: newPoolReward.label,
      rewardCost: newPoolReward.cost,
      createdBy: email,
      createdByName: name,
      pledge: isNaN(pledge) || pledge < 0 ? 0 : pledge,
      notes: newPoolNote,
    });
    setShowNewPool(false);
    setNewPoolPledge("");
    setNewPoolNote("");
    setNewPoolReward(REWARDS[0]);
    refreshPools();
    setPoolStatus({ ok: true, message: `Pool started for "${newPoolReward.label}"!` });
  }

  function handleAddPledge(poolId) {
    const amount = parseInt(pledgeAmount, 10);
    if (isNaN(amount) || amount <= 0) return;
    addOrUpdatePledge(poolId, { email, name, amount });
    setPledgingPoolId(null);
    setPledgeAmount("");
    refreshPools();
  }

  function handleRemovePledge(poolId) {
    removePledge(poolId, email);
    refreshPools();
  }

  async function handleRedeemPool(pool) {
    const total = getPoolTotal(pool);
    const poolNote = `Group pool (${pool.pledges.length} contributors): ${pool.pledges.map((p) => `${p.name} ${p.amount.toLocaleString()} GD`).join(", ")}`;
    try {
      await submitRedemption({ actor: pool.createdBy, reward: pool.rewardLabel, cost: total, notes: poolNote });
    } catch {
      // Non-fatal — mark redeemed locally regardless
    }
    markPoolRedeemed(pool.id);
    refreshPools();
    setPoolStatus({ ok: true, message: `"${pool.rewardLabel}" redemption submitted!` });
  }

  function handleCancelPool(poolId) {
    deletePool(poolId, email);
    refreshPools();
  }

  const openPools = pools.filter((p) => p.status === "open");
  const redeemedPools = pools.filter((p) => p.status === "redeemed");

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

          <h4 className="gd-rewards-title">Redeem on Your Own</h4>
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
              <button className="btn-primary" onClick={handleRedeem} disabled={redeeming}>
                {redeeming ? "Submitting..." : "Submit Redemption Request"}
              </button>
            </div>
          )}

          {status && (
            <p className={`gd-status ${status.ok ? "ok" : "error"}`}>{status.message}</p>
          )}
        </>
      )}

      {/* Pool Section */}
      <div className="gd-pool-section">
        <div className="gd-pool-section-header">
          <div>
            <h4 className="gd-rewards-title" style={{ margin: 0 }}>Pool with Your Team</h4>
            <p className="gd-sub">Combine GeniusDollars toward a shared experience.</p>
          </div>
          <button
            className="btn-secondary gd-pool-toggle-btn"
            onClick={() => setShowNewPool((v) => !v)}
          >
            {showNewPool ? "Cancel" : "+ Start a Pool"}
          </button>
        </div>

        {showNewPool && (
          <div className="gd-redeem-form" style={{ marginTop: 14 }}>
            <div className="gd-pool-form-row">
              <label className="gd-pool-label">Reward</label>
              <select
                className="gd-pool-select"
                value={newPoolReward.label}
                onChange={(e) => setNewPoolReward(REWARDS.find((r) => r.label === e.target.value))}
              >
                {REWARDS.map((r) => (
                  <option key={r.label} value={r.label}>
                    {r.label} — {r.cost.toLocaleString()} GD
                  </option>
                ))}
              </select>
            </div>
            <div className="gd-pool-form-row">
              <label className="gd-pool-label">My Opening Pledge (GD)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 500"
                className="gd-pool-input"
                value={newPoolPledge}
                onChange={(e) => setNewPoolPledge(e.target.value)}
              />
            </div>
            <textarea
              className="gd-notes-input"
              placeholder="Optional note for your teammates..."
              value={newPoolNote}
              onChange={(e) => setNewPoolNote(e.target.value)}
              rows={2}
            />
            <button className="btn-primary" onClick={handleCreatePool}>
              Start Pool
            </button>
          </div>
        )}

        {openPools.length === 0 && !showNewPool && (
          <p className="gd-loading" style={{ marginTop: 12 }}>No active pools. Start one!</p>
        )}

        <div className="gd-pool-list">
          {openPools.map((pool) => {
            const total = getPoolTotal(pool);
            const pct = Math.min(100, Math.round((total / pool.rewardCost) * 100));
            const isFunded = total >= pool.rewardCost;
            const myPledge = pool.pledges.find((p) => p.email.toLowerCase() === email?.toLowerCase());
            const isCreator = pool.createdBy.toLowerCase() === email?.toLowerCase();
            const isPledging = pledgingPoolId === pool.id;

            return (
              <div key={pool.id} className={`gd-pool-card ${isFunded ? "funded" : ""}`}>
                <div className="gd-pool-card-header">
                  <div>
                    <span className="gd-pool-reward-name">{pool.rewardLabel}</span>
                    <span className="gd-pool-meta">Started by {pool.createdByName}</span>
                  </div>
                  <span className="gd-pool-cost-badge">{pool.rewardCost.toLocaleString()} GD goal</span>
                </div>

                {pool.notes && <p className="gd-pool-note">"{pool.notes}"</p>}

                <div className="gd-pool-progress">
                  <div className="gd-pool-bar-track">
                    <div className="gd-pool-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="gd-pool-progress-labels">
                    <span>{total.toLocaleString()} / {pool.rewardCost.toLocaleString()} GD</span>
                    <span className={isFunded ? "gd-funded-label" : ""}>{isFunded ? "Funded!" : `${pct}%`}</span>
                  </div>
                </div>

                <div className="gd-pool-pledges">
                  {pool.pledges.map((p) => (
                    <span key={p.email} className="gd-pledge-chip">
                      {p.name.split(" ")[0]}: {p.amount.toLocaleString()} GD
                    </span>
                  ))}
                  {pool.pledges.length === 0 && (
                    <span className="gd-pool-meta">No pledges yet — be the first!</span>
                  )}
                </div>

                <div className="gd-pool-actions">
                  {isFunded ? (
                    <button className="btn-primary" onClick={() => handleRedeemPool(pool)}>
                      Redeem for Team
                    </button>
                  ) : (
                    <>
                      {myPledge ? (
                        <div className="gd-pool-pledge-row">
                          <span className="gd-pool-meta">Your pledge: {myPledge.amount.toLocaleString()} GD</span>
                          {isPledging ? (
                            <>
                              <input
                                type="number"
                                min="1"
                                placeholder="New amount"
                                className="gd-pool-input gd-pool-input-sm"
                                value={pledgeAmount}
                                onChange={(e) => setPledgeAmount(e.target.value)}
                              />
                              <button className="btn-secondary" onClick={() => handleAddPledge(pool.id)}>Save</button>
                              <button className="btn-secondary" onClick={() => setPledgingPoolId(null)}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button className="btn-secondary" onClick={() => { setPledgingPoolId(pool.id); setPledgeAmount(String(myPledge.amount)); }}>Update</button>
                              <button className="btn-secondary" onClick={() => handleRemovePledge(pool.id)}>Remove</button>
                            </>
                          )}
                        </div>
                      ) : (
                        isPledging ? (
                          <div className="gd-pool-pledge-row">
                            <input
                              type="number"
                              min="1"
                              placeholder="GD amount"
                              className="gd-pool-input gd-pool-input-sm"
                              value={pledgeAmount}
                              onChange={(e) => setPledgeAmount(e.target.value)}
                            />
                            <button className="btn-primary" onClick={() => handleAddPledge(pool.id)}>Pledge</button>
                            <button className="btn-secondary" onClick={() => setPledgingPoolId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <button className="btn-secondary" onClick={() => { setPledgingPoolId(pool.id); setPledgeAmount(""); }}>
                            Add My Pledge
                          </button>
                        )
                      )}
                    </>
                  )}
                  {isCreator && !isFunded && (
                    <button className="gd-pool-cancel-btn" onClick={() => handleCancelPool(pool.id)}>
                      Cancel Pool
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {redeemedPools.length > 0 && (
          <details className="gd-pool-redeemed-section">
            <summary className="gd-pool-meta" style={{ cursor: "pointer", userSelect: "none" }}>
              {redeemedPools.length} redeemed pool{redeemedPools.length > 1 ? "s" : ""} ▾
            </summary>
            {redeemedPools.map((pool) => (
              <div key={pool.id} className="gd-pool-card redeemed">
                <span className="gd-pool-reward-name">{pool.rewardLabel}</span>
                <span className="gd-pool-meta"> — Redeemed ✓</span>
              </div>
            ))}
          </details>
        )}

        {poolStatus && (
          <p className={`gd-status ${poolStatus.ok ? "ok" : "error"}`} style={{ marginTop: 12 }}>
            {poolStatus.message}
          </p>
        )}
      </div>
    </div>
  );
}
