import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
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
import RealtimeVoicePanel from "../components/simulator/RealtimeVoicePanel";

export default function SalesSimulator() {
  const location = useLocation();
  const account = location.state?.account || null;

  const [currentAudio, setCurrentAudio] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [customerType, setCustomerType] = useState("skeptical-store-owner");
  const [difficulty, setDifficulty] = useState("medium");
  const [messages, setMessages] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [objections, setObjections] = useState([]);
  const [score, setScore] = useState(null);
  const [isScoring, setIsScoring] = useState(false);
  const [isCustomerThinking, setIsCustomerThinking] = useState(false);
  const [repLastMessageTime, setRepLastMessageTime] = useState(null);

  const baseScenario = getScenario(customerType);

  const scenario = account
    ? {
        ...baseScenario,
        opener: `You are ${account.primaryBuyer || "the buyer"} from ${
          account.dealerName || "this dealer account"
        }. You are speaking with your sales rep.

Current Situation:
- Dealer: ${account.dealerName || "Unknown"}
- Primary Buyer: ${account.primaryBuyer || "Unknown"}
- Assigned Rep: ${account.assignedRep || "Unassigned"}
- Category to Expand: ${account.categoryToExpand || "Not defined"}
- Barrier: ${account.barrier || "No clear barrier yet"}
- Strategy: ${account.howWeGetThere || "General growth discussion"}
- Status: ${account.statusLabel || "Unknown"}

Personality:
Act like a real buyer. Be skeptical but realistic. Respond naturally based on the rep’s approach. Do not make the call too easy.`,
      }
    : baseScenario;

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
      default:
        return "alloy";
    }
  }

  async function speakCustomerReply(text) {
    if (!text) return;

    try {
      if (currentAudio) {
        currentAudio.pause();
      }

      const response = await fetch("/api/speak-customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voice: getVoiceForCustomer(customerType),
        }),
      });

      if (!response.ok) {
        throw new Error("Speech API failed");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };

      setCurrentAudio(audio);
      audio.play();
    } catch (error) {
      console.error("Speech playback error:", error);
    }
  }

  function startSession() {
    if (currentAudio) {
      currentAudio.pause();
    }

    setMessages([]);
    setOrderItems([]);
    setObjections([]);
    setScore(null);
    setIsScoring(false);
    setIsCustomerThinking(false);
    setRepLastMessageTime(Date.now());
    setIsLive(true);
    setIsEnded(false);

    setTimeout(() => {
      addMessage("AI Customer", scenario.opener);
      speakCustomerReply(scenario.opener);
    }, 300);
  }

  async function getCustomerReply(updatedMessages) {
    setIsCustomerThinking(true);

    try {
      const response = await fetch("/api/customer-reply", {
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
          account,
        }),
      });

      if (!response.ok) {
        throw new Error("AI customer reply failed");
      }

      const data = await response.json();
      const reply = data.reply || "Tell me more about what you recommend.";

      setTimeout(() => {
        addMessage("AI Customer", reply);
        speakCustomerReply(reply);
      }, 600 + Math.random() * 900);
    } catch (error) {
      console.error(error);

      const fallback =
        "I’m having trouble following. Can you explain that another way?";

      setTimeout(() => {
        addMessage("AI Customer", fallback);
        speakCustomerReply(fallback);
      }, 600);
    } finally {
      setIsCustomerThinking(false);
    }
  }

  async function sendRepMessage(text) {
    if (!text.trim() || isCustomerThinking) return;

    const now = Date.now();
    setRepLastMessageTime(now);

    const repMessage = addMessage("Sales Rep", text.trim());
    const updatedMessages = [...messages, repMessage];

    await getCustomerReply(updatedMessages);
  }

  async function customerReply() {
    if (isCustomerThinking) return;
    await getCustomerReply(messages);
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

  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      if (!repLastMessageTime || isCustomerThinking) return;

      const timeSinceLastRep = Date.now() - repLastMessageTime;

      if (timeSinceLastRep > 8000) {
        addMessage("AI Customer", "You still there?");
        speakCustomerReply("You still there?");
        setRepLastMessageTime(Date.now());
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isLive, repLastMessageTime, isCustomerThinking]);

  async function endSession() {
    if (currentAudio) {
      currentAudio.pause();
    }

    setIsLive(false);
    setIsEnded(true);
    setIsScoring(true);
    setScore(null);
    setIsCustomerThinking(false);

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
          account,
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

      {account && (
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

      <RealtimeVoicePanel
        customerType={customerType}
        difficulty={difficulty}
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
          <p>Scoring conversation...</p>
        </section>
      )}

      {score && <ScorePanel score={score} />}
    </main>
  );
}