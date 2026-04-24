import { useState } from "react";
import ControlPanel from "../components/simulator/ControlPanel";
import TranscriptPanel from "../components/simulator/TranscriptPanel";
import OrderBuilder from "../components/simulator/OrderBuilder";
import ScorePanel from "../components/simulator/ScorePanel";
import {
  customerTypes,
  difficultyLevels,
  getScenario,
} from "../data/customerScenarios";
import "../styles/simulator.css";

export default function SalesSimulator() {
  const [isLive, setIsLive] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [customerType, setCustomerType] = useState("skeptical-store-owner");
  const [difficulty, setDifficulty] = useState("medium");
  const [messages, setMessages] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [objections, setObjections] = useState([]);
  const [score, setScore] = useState(null);
  const [isScoring, setIsScoring] = useState(false);

  const scenario = getScenario(customerType);

  function addMessage(speaker, text) {
    setMessages((prev) => [
      ...prev,
      {
        speaker,
        text,
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  function startSession() {
    setMessages([]);
    setOrderItems([]);
    setObjections([]);
    setScore(null);
    setIsScoring(false);
    setIsLive(true);
    setIsEnded(false);

    setTimeout(() => addMessage("AI Customer", scenario.opener), 150);
  }

  function sendRepMessage(text) {
    if (!text.trim()) return;
    addMessage("Sales Rep", text.trim());
  }

  function customerReply() {
    const customerMessageCount = messages.filter(
      (message) => message.speaker === "AI Customer"
    ).length;

    const reply =
      scenario.replies[
        Math.min(customerMessageCount, scenario.replies.length - 1)
      ];

    addMessage("AI Customer", reply);
  }

  function addOrderItem(item) {
    setOrderItems((prev) => [...prev, item]);
  }

  function toggleObjection(value) {
    setObjections((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  }

  async function endSession() {
    setIsLive(false);
    setIsEnded(true);
    setIsScoring(true);
    setScore(null);

    try {
      const response = await fetch("/api/score-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: messages,
          orderItems,
          objections,
          customerType,
          difficulty,
          scenario,
        }),
      });

      if (!response.ok) {
        throw new Error("AI scoring request failed");
      }

      const aiScore = await response.json();

      setScore({
        overall: aiScore.overall ?? 0,
        discovery: aiScore.discovery ?? 0,
        orderBuilding: aiScore.orderBuilding ?? 0,
        objectionHandling: aiScore.objectionHandling ?? 0,
        closing: aiScore.closing ?? 0,
        strengths: aiScore.strengths || [],
        missedOpportunities: aiScore.missedOpportunities || [],
        coachingNote: aiScore.coachingNote || "",
        betterPhrases: aiScore.betterPhrases || [],
      });
    } catch (error) {
      console.error(error);

      setScore({
        overall: 0,
        discovery: 0,
        orderBuilding: 0,
        objectionHandling: 0,
        closing: 0,
        strengths: [],
        missedOpportunities: [],
        betterPhrases: [],
        coachingNote:
          "AI scoring could not run. Check /api/score-call and your OPENAI_API_KEY in Vercel.",
      });
    } finally {
      setIsScoring(false);
    }
  }

  return (
    <main className="simulator-shell">
      <section className="simulator-hero">
        <div>
          <p className="simulator-eyebrow">GeniusSeeker Training Lab</p>
          <h1>AI Customer Sales Simulator</h1>
          <p>
            Practice a live sales conversation, handle objections, build an
            order, and receive coaching feedback.
          </p>
        </div>

        <div className="simulator-status-card">
          <span
            className={`simulator-status-dot ${
              isLive ? "live" : isEnded ? "ended" : "idle"
            }`}
          />
          <strong>
            {isLive
              ? "Live mock session"
              : isScoring
              ? "Scoring with AI..."
              : isEnded
              ? "Session ended"
              : "Ready to begin"}
          </strong>
        </div>
      </section>

      <ControlPanel
        customerTypes={customerTypes}
        difficultyLevels={difficultyLevels}
        customerType={customerType}
        setCustomerType={setCustomerType}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        isLive={isLive}
        startSession={startSession}
        endSession={endSession}
        scenario={scenario}
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
          <h2>AI Coaching Report</h2>
          <p>Scoring conversation...</p>
        </section>
      )}

      {score && <ScorePanel score={score} />}
    </main>
  );
}