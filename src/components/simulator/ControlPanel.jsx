export default function ControlPanel({
  customerType,
  setCustomerType,
  difficulty,
  setDifficulty,
  isLive,
  startSession,
  endSession,
}) {
  return (
    <section className="simulator-control-panel">
      <label>
        Customer Type
        <select
          value={customerType}
          onChange={(event) => setCustomerType(event.target.value)}
          disabled={isLive}
        >
          <option value="skeptical">Skeptical Store Owner</option>
          <option value="friendly">Friendly Repeat Buyer</option>
          <option value="price-shopper">Price Shopper</option>
          <option value="rushed">Rushed Buyer</option>
          <option value="expert">Expert Buyer</option>
        </select>
      </label>

      <label>
        Difficulty
        <select
          value={difficulty}
          onChange={(event) => setDifficulty(event.target.value)}
          disabled={isLive}
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </label>

      <button onClick={startSession} disabled={isLive}>
        Start AI Customer Call
      </button>

      <button onClick={endSession} disabled={!isLive}>
        End Call / Score Me
      </button>
    </section>
  );
}