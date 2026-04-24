import { useState } from "react";
import ControlPanel from "../components/simulator/ControlPanel";
import TranscriptPanel from "../components/simulator/TranscriptPanel";
import OrderBuilder from "../components/simulator/OrderBuilder";
import ScorePanel from "../components/simulator/ScorePanel";
import "../styles/simulator.css";

const mockCustomerReplies = {
  skeptical: [
    "Before I add anything, tell me why I should order from you instead of my current distributor.",
    "Price matters, but I also need to know what is actually moving right now.",
    "I do not want dead inventory. What would you recommend for a weekend promotion?",
    "Shipping has burned me before. How fast can I realistically get this?",
    "Okay, build me a small order that makes sense, but do not overload me.",
  ],
  friendly: [
    "Good to hear from you. I need a few things, but I am open to suggestions.",
    "What are your best movers this week?",
    "That could work. What would you pair with it?",
    "Can you help me keep this order balanced?",
    "Go ahead and recap what you recommend.",
  ],
  "price-shopper": [
    "I am mostly comparing prices today.",
    "Your competitor says they can beat that.",
    "What kind of margin can I make on this?",
    "I am not buying unless the numbers make sense.",
    "Give me your tightest practical order.",
  ],
  rushed: [
    "I only have five minutes. What do you have that I should care about?",
    "Get to the point for me.",
    "Is it in stock or not?",
    "What is the fastest order you can build for me?",
    "Okay, summarize it quickly.",
  ],
  expert: [
    "I already know the market. Tell me what is different this week.",
    "What SKUs are moving that others are missing?",
    "I need data, not a generic pitch.",
    "How would you structure this order by customer demand?",
    "Convince me this order will turn.",
  ],
};

export default function SalesSimulator() {
  const [isLive, setIsLive] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [customerType, setCustomerType] = useState("skeptical");
  const [difficulty, setDifficulty] = useState("medium");
  const [messages, setMessages] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [objections, setObjections] = useState([]);
  const [score, setScore] = useState(null);

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
    setIsLive(true);
    setIsEnded(false);

    const opener = mockCustomerReplies[customerType][0];
    setTimeout(() => addMessage("AI Customer", opener), 150);
  }

  function sendRepMessage(text) {
    if (!text.trim()) return;
    addMessage("Sales Rep", text.trim());
  }

  function customerReply() {
    const replies = mockCustomerReplies[customerType];
    const customerMessageCount = messages.filter(
      (message) => message.speaker === "AI Customer"
    ).length;

    const reply = replies[Math.min(customerMessageCount, replies.length - 1)];
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

  function endSession() {
    const repMessages = messages.filter(
      (message) => message.speaker === "Sales Rep"
    ).length;

    const discovery = Math.min(100, 40 + repMessages * 10);
    const orderBuilding = Math.min(100, orderItems.length * 25);
    const objectionHandling = Math.min(100, objections.length * 20 + repMessages * 5);
    const closing = orderItems.length > 0 ? 80 : 35;
    const overall = Math.round(
      (discovery + orderBuilding + objectionHandling + closing) / 4
    );

    setScore({
      overall,
      discovery,
      orderBuilding,
      objectionHandling,
      closing,
      coachingNote:
        "This is mock scoring for UI testing. The API version will evaluate the full transcript, objections, tone, discovery questions, buying signals, and final order quality.",
    });

    setIsLive(false);
    setIsEnded(true);
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
            {isLive ? "Live mock session" : isEnded ? "Session ended" : "Ready to begin"}
          </strong>
        </div>
      </section>

      <ControlPanel
        customerType={customerType}
        setCustomerType={setCustomerType}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        isLive={isLive}
        startSession={startSession}
        endSession={endSession}
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

      {score && <ScorePanel score={score} />}
    </main>
  );
}