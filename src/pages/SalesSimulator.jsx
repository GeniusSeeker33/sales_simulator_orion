import { learnerFetch } from "../lib/learnerFetch";
import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import LearnerHistory from "../components/LearnerHistory";
import { beginAttempt, finishAttempt } from "../lib/learnerRecords";
import { evaluatePractice } from "../lib/evaluatePractice";
import ControlPanel from "../components/simulator/ControlPanel";

import { loadProducts } from "../lib/productStore";

import TranscriptPanel from "../components/simulator/TranscriptPanel";
import OrderBuilder from "../components/simulator/OrderBuilder";
import ScorePanel from "../components/simulator/ScorePanel";
import {
  customerTypes,
  difficultyLevels,
  getScenario,
} from "../data/customerScenarios";
import "../styles/simulator.css";
import RealtimeVoicePanel from "../components/simulator/RealtimeVoicePanel";

export default function SalesSimulator() {
  const location = useLocation();

  const account = location.state?.account || null;
  const isColdCall =
    Boolean(location.state?.isColdCall) ||
    account?.source === "FFL Prospect Hub";

  const products = useMemo(() => loadProducts(), []);

  const recommendedProducts = useMemo(() => {
    if (!products.length) return [];

    const accountCategory = String(account?.categoryToExpand || "").toLowerCase();

    const matches = products.filter((product) => {
      const category = String(product.category || "").toLowerCase();
      const recommendedFor = String(product.recommendedFor || "").toLowerCase();

      return (
        accountCategory &&
        (category.includes(accountCategory) ||
          recommendedFor.includes(accountCategory))
      );
    });

    return matches.length ? matches.slice(0, 5) : products.slice(0, 5);
  }, [products, account]);

  const availableProducts = useMemo(() => {
    return recommendedProducts.length ? recommendedProducts : products;
  }, [recommendedProducts, products]);

  const [currentAudio, setCurrentAudio] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [customerType, setCustomerType] = useState("skeptical-store-owner");
  const [difficulty, setDifficulty] = useState("medium");
  const [messages, setMessages] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [objections, setObjections] = useState([]);
  const [score, setScore] = useState(null);
  const glcdEarned = null;
  const attemptRef = useRef(null);
  const busyRef = useRef(false);
  const endedRef = useRef(false);
  const pendingRef = useRef(null);
  const [recordMessage, setRecordMessage] = useState("");
  const [historyRevision, setHistoryRevision] = useState(0);
  const [isScoring, setIsScoring] = useState(false);
  const [isCustomerThinking, setIsCustomerThinking] = useState(false);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);

  const baseScenario = getScenario(customerType);

  const scenario = {
    ...baseScenario,
    dealerContext: account ? {
      business: account.dealerName,
      location: account.location,
      relationship: isColdCall ? "First unsolicited call; no prior relationship with this caller" : "Existing dealer account",
      categoryInterest: account.categoryToExpand,
      currentConcern: account.barrier,
    } : {},
  };

  function addMessage(speaker, text) {
    const newMessage = {
      speaker,
      text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  }

  function getVoiceForCustomer(type) {
    switch (type) {
      case "angry-customer":
        return "verse";
      case "rushed-buyer":
        return "alloy";
      case "friendly-repeat-buyer":
        return "nova";
      case "expert-buyer":
        return "onyx";
      case "price-shopper":
        return "echo";
      case "indecisive-buyer":
        return "shimmer";
      case "defer-to-partner":
        return "ballad";
      case "ffl-compliance-dealer":
        return "ash";
      case "loyal-to-competitor":
        return "verse";
      default:
        return "alloy";
    }
  }

  async function speakCustomerReply(text) {
    if (!text) return;
    if (isVoiceConnected || endedRef.current) return;
    const speechAttempt = attemptRef.current;

    try {
      if (currentAudio) currentAudio.pause();

      const response = await learnerFetch("/api/speak-customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voice: getVoiceForCustomer(customerType),
        }),
      });

      if (!response.ok) throw new Error("Speech API failed");

      if (endedRef.current || attemptRef.current !== speechAttempt) return;
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => URL.revokeObjectURL(audioUrl);

      setCurrentAudio(audio);
      await audio.play();
    } catch (error) {
      console.error("Speech playback error:", error);
      if (!endedRef.current && attemptRef.current === speechAttempt) await endSession(null, true);
    }
  }

  async function startSession(voice = false) {
    if (busyRef.current || pendingRef.current || (attemptRef.current && !endedRef.current)) return false;
    busyRef.current = true;
    const id = crypto.randomUUID();
    try {
      await beginAttempt(id, "simulation", customerType, difficulty);
    } catch (error) {
      setRecordMessage(error.message); busyRef.current = false; return false;
    }
    attemptRef.current = id;
    endedRef.current = false;
    busyRef.current = false;
    setRecordMessage("Session saved; practice is in progress.");
    setHistoryRevision(n => n + 1);
    if (currentAudio) currentAudio.pause();

    setMessages([]);
    setOrderItems([]);
    setObjections([]);
    setScore(null);

    setIsScoring(false);
    setIsCustomerThinking(false);
    setIsLive(true);
    setIsEnded(false);

    if (voice !== true) void getCustomerReply([]);
    return true;
  }

  async function getCustomerReply(updatedMessages) {
    const replyAttempt = attemptRef.current;
    setIsCustomerThinking(true);

    try {
      const response = await learnerFetch("/api/customer-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: updatedMessages,
          customerType,
          difficulty,
          scenario,
          orderItems,
          objections,
          products: availableProducts,
        }),
      });

      if (!response.ok) throw new Error("AI customer reply failed");

      const data = await response.json();
      if (endedRef.current || attemptRef.current !== replyAttempt) return;
      if (!data.reply) throw new Error("Missing provider reply");
      const reply =
        data.reply ||
        "Which SKU are you recommending, and why does that make sense for my store?";

      setTimeout(() => {
        if (endedRef.current || attemptRef.current !== replyAttempt) return;
        addMessage("AI Customer", reply);
        speakCustomerReply(reply);
      }, 600 + Math.random() * 900);
    } catch (error) {
      console.error(error);

      if (!endedRef.current && attemptRef.current === replyAttempt) await endSession(null, true);
    } finally {
      setIsCustomerThinking(false);
    }
  }

  async function sendRepMessage(text) {
    if (!isLive || endedRef.current || !text.trim() || isCustomerThinking) return;


    const repMessage = addMessage("Sales Rep", text.trim());
    const updatedMessages = [...messages, repMessage];

    await getCustomerReply(updatedMessages);
  }

  async function customerReply() {
    if (!isLive || endedRef.current || isCustomerThinking) return;
    await getCustomerReply(messages);
  }

  function addOrderItem(item) {
    setOrderItems((prev) => [...prev, item]);
  }

  function addProductToOrder(product) {
    const item = {
      id: product.id || product.sku || product.name,
      sku: product.sku || "",
      name: product.name || "Unnamed Product",
      category: product.category || "",
      dealerPrice: product.dealerPrice || 0,
      retailPrice: product.retailPrice || 0,
      inventory: product.inventory || 0,
      quantity: 1,
      source: product.source || "Imported Inventory",
    };

    setOrderItems((prev) => [...prev, item]);
  }

  function toggleObjection(value) {
    setObjections((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  }

  useEffect(() => {
    if (isVoiceConnected && currentAudio) {
      currentAudio.pause();
    }
  }, [isVoiceConnected, currentAudio]);

  async function persistPending() {
    const pending = pendingRef.current;
    if (!pending || busyRef.current) return;
    busyRef.current = true;
    try {
      await finishAttempt(pending.id, pending.status, pending.score);
      pendingRef.current = null;
      setRecordMessage("Session saved durably. AI practice feedback is unreviewed; no progression or reward is awarded.");
      setHistoryRevision(n => n + 1);
    } catch (error) { setRecordMessage(error.message); }
    finally { busyRef.current = false; }
  }

  async function endSession(overrideTranscript = null, technicalFailure = false) {
    if (!attemptRef.current || endedRef.current) return;
    endedRef.current = true;
    if (currentAudio) currentAudio.pause();
    const transcriptToScore = Array.isArray(overrideTranscript) ? overrideTranscript : messages;
    setIsLive(false); setIsEnded(true); setIsScoring(true); setScore(null); setIsCustomerThinking(false);
    const outcome = await evaluatePractice(transcriptToScore, () => learnerFetch("/api/score-call", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: transcriptToScore, orderItems, objections, customerType, difficulty, scenario, account, products: availableProducts }),
    }), technicalFailure || isCustomerThinking);
    setScore(outcome.score ? { ...outcome.score, coachingNote: outcome.feedback } : {
      overall: null, discovery: null, orderBuilding: null, objectionHandling: null, closing: null,
      coachingNote: outcome.status === "technical_failure" ? "Technical/provider failure — unscored. This is not a competence result." : "No learner response was observed — unscored.",
    });
    pendingRef.current = { id: attemptRef.current, status: outcome.status, score: outcome.score };
    await persistPending();
    setIsScoring(false);
  }

  return (
    <main className="simulator-shell">
      <p role="status">{recordMessage}</p>
      {pendingRef.current && <button disabled={isScoring} onClick={persistPending}>Retry saving this session</button>}
      <LearnerHistory revision={historyRevision} />
      <section className="simulator-hero">
        <div>
          <p className="simulator-eyebrow">
            {isColdCall ? "Cold Call Practice — FFL Prospect" : "Orion Sales Training Lab"}
          </p>
          <h1>
            {isColdCall ? "🎯 Cold Call Simulator" : "AI Customer Sales Simulator"}
          </h1>
          {isColdCall && (
            <p className="coach-text" style={{ maxWidth: 600 }}>
              You're calling <strong>{account?.dealerName || "this FFL dealer"}</strong> for the first time. The customer doesn't know you. Earn their attention before pitching anything.
            </p>
          )}
        </div>

        <div className="simulator-status-card">
          <span
            className={`simulator-status-dot ${
              isLive ? "live" : isEnded ? "ended" : "idle"
            }`}
          />
          <strong>
            {isCustomerThinking
              ? "AI customer thinking..."
              : isLive
              ? "Live AI customer session"
              : isScoring
              ? "Scoring with AI..."
              : isEnded
              ? "Session ended"
              : "Ready to begin"}
          </strong>
        </div>
      </section>

      {account && !isColdCall && (
        <section className="simulator-panel">
          <h3>Live Account Context</h3>
          <p>
            <strong>Dealer:</strong> {account.dealerName || "—"}
          </p>
          <p>
            <strong>Buyer:</strong> {account.primaryBuyer || "—"}
          </p>
          <p>
            <strong>Rep:</strong> {account.assignedRep || "—"}
          </p>
          <p>
            <strong>Category:</strong> {account.categoryToExpand || "—"}
          </p>
          <p>
            <strong>Barrier:</strong> {account.barrier || "—"}
          </p>
        </section>
      )}

      {account && isColdCall && (
        <section
          className="simulator-panel"
          style={{
            borderColor: "rgba(248,113,113,0.35)",
            background: "rgba(248,113,113,0.06)",
          }}
        >
          <h3>🎯 Cold FFL Prospect</h3>
          <p>
            <strong>Business:</strong> {account.dealerName || "—"}
          </p>
          <p>
            <strong>Licensee:</strong> {account.primaryBuyer || "—"}
          </p>
          <p>
            <strong>Location:</strong> {account.location || "—"}
          </p>
          <p>
            <strong>Phone:</strong> {account.phone || "—"}
          </p>
          <p className="coach-text" style={{ marginTop: 8 }}>
            This is a true cold call. The customer has never heard of Orion. Lead with discovery, not a pitch. Earn the right to ask for the order.
          </p>
        </section>
      )}

      <section className="simulator-panel">
        <h3>Recommended Inventory</h3>

        {recommendedProducts.length > 0 ? (
          <div className="table-wrap">
            <table className="accounts-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Dealer</th>
                  <th>Retail</th>
                  <th>Velocity</th>
                  <th>Add</th>
                </tr>
              </thead>
              <tbody>
                {recommendedProducts.map((product) => (
                  <tr key={product.id || product.sku || product.name}>
                    <td>{product.sku || "—"}</td>
                    <td>{product.name || "—"}</td>
                    <td>{product.category || "—"}</td>
                    <td>{product.inventory ?? "—"}</td>
                    <td>{formatMoney(product.dealerPrice)}</td>
                    <td>{formatMoney(product.retailPrice)}</td>
                    <td>{product.velocity || "—"}</td>
                    <td>
                      <button
                        className="btn-secondary"
                        onClick={() => addProductToOrder(product)}
                      >
                        Add
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="coach-text">
            No imported products found yet. Import products from Admin Import to
            use real inventory in the simulator.
          </p>
        )}
      </section>

      <ControlPanel
        customerTypes={customerTypes}
        difficultyLevels={difficultyLevels}
        customerType={customerType}
        setCustomerType={setCustomerType}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        isLive={isLive}
        isBusy={isScoring || isVoiceConnected || !!pendingRef.current}
        startSession={() => startSession(false)}
        endSession={endSession}
      />

      <RealtimeVoicePanel
        onStart={() => startSession(true)}
        onFailure={() => endSession(null, true)}
        disabled={isLive || isScoring || !!pendingRef.current}
        customerType={customerType}
        difficulty={difficulty}
        scenario={scenario}
        products={availableProducts}
        addMessage={addMessage}
        onCallEnded={endSession}
        onConnectedChange={setIsVoiceConnected}
      />

      <section className="simulator-workspace">
        <TranscriptPanel
          messages={messages}
          isLive={isLive}
          sendRepMessage={sendRepMessage}
          customerReply={customerReply}
        />

        <OrderBuilder
          orderItems={orderItems}
          addOrderItem={addOrderItem}
          objections={objections}
          toggleObjection={toggleObjection}
        />
      </section>

      {isScoring && (
        <section className="simulator-panel simulator-score-panel">
          <p>Scoring conversation...</p>
        </section>
      )}

      {score && <ScorePanel score={score} glcdEarned={glcdEarned} />}
    </main>
  );
}

function formatMoney(value) {
  if (value === undefined || value === null || value === "") return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}
