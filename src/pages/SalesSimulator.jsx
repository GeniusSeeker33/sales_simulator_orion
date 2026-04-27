import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import ControlPanel from "../components/simulator/ControlPanel";
import { addSimulatorResult } from "../lib/simulatorResultsStore";
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
  const [isScoring, setIsScoring] = useState(false);
  const [isCustomerThinking, setIsCustomerThinking] = useState(false);
  const [repLastMessageTime, setRepLastMessageTime] = useState(null);

  const baseScenario = getScenario(customerType);

  const inventoryContext = availableProducts
    .map(
      (p) =>
        `- ${p.name || p.sku}: ${p.category || "Uncategorized"}, ${
          p.inventory ?? 0
        } in stock, dealer price ${formatMoney(
          p.dealerPrice
        )}, retail ${formatMoney(p.retailPrice)}, velocity ${
          p.velocity || "Unknown"
        }`
    )
    .join("\n");

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

Available Inventory:
${inventoryContext || "- No imported inventory available yet."}

Personality:
Act like a real buyer. Be skeptical but realistic. Ask questions about margin, sell-through, inventory risk, price, and why this product makes sense for your store. Do not make the call too easy.`,
      }
    : {
        ...baseScenario,
        opener: `${baseScenario.opener}

Available Inventory:
${inventoryContext || "- No imported inventory available yet."}`,
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
      default:
        return "alloy";
    }
  }

  async function speakCustomerReply(text) {
    if (!text) return;

    try {
      if (currentAudio) currentAudio.pause();

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

      if (!response.ok) throw new Error("Speech API failed");

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => URL.revokeObjectURL(audioUrl);

      setCurrentAudio(audio);
      audio.play();
    } catch (error) {
      console.error("Speech playback error:", error);
    }
  }

  function startSession() {
    if (currentAudio) currentAudio.pause();

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
          products: availableProducts,
        }),
      });

      if (!response.ok) throw new Error("AI customer reply failed");

      const data = await response.json();
      const reply =
        data.reply ||
        "Which SKU are you recommending, and why does that make sense for my store?";

      setTimeout(() => {
        addMessage("AI Customer", reply);
        speakCustomerReply(reply);
      }, 600 + Math.random() * 900);
    } catch (error) {
      console.error(error);

      const fallback =
        "I’m having trouble following. Which SKU are you recommending?";

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

    setRepLastMessageTime(Date.now());

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

  function saveSimulatorSession(finalScore, error = null) {
    addSimulatorResult({
      accountId: account?.id || null,
      dealerName: account?.dealerName || "General Scenario",
      primaryBuyer: account?.primaryBuyer || "",
      assignedRep: account?.assignedRep || "",
      customerType,
      difficulty,
      score: finalScore,
      transcript: messages,
      orderItems,
      objections,
      productsUsed: orderItems,
      availableProducts,
      error,
    });
  }

  async function endSession() {
    if (currentAudio) currentAudio.pause();

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
          products: availableProducts,
        }),
      });

      if (!response.ok) throw new Error("AI scoring request failed");

      const aiScore = await response.json();

      const finalScore = {
        overall: aiScore.overall ?? 0,
        discovery: aiScore.discovery ?? 0,
        orderBuilding: aiScore.orderBuilding ?? 0,
        objectionHandling: aiScore.objectionHandling ?? 0,
        closing: aiScore.closing ?? 0,
        strengths: aiScore.strengths || [],
        missedOpportunities: aiScore.missedOpportunities || [],
        coachingNote: aiScore.coachingNote || "",
        betterPhrases: aiScore.betterPhrases || [],
      };

      setScore(finalScore);
      saveSimulatorSession(finalScore);
    } catch (error) {
      console.error(error);

      const fallbackScore = {
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
      };

      setScore(fallbackScore);
      saveSimulatorSession(fallbackScore, "AI scoring failed");
    } finally {
      setIsScoring(false);
    }
  }

  return (
    <main className="simulator-shell">
      <section className="simulator-hero">
        <div>
          <p className="simulator-eyebrow">Orion Sales Training Lab</p>
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

function formatMoney(value) {
  if (value === undefined || value === null || value === "") return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}