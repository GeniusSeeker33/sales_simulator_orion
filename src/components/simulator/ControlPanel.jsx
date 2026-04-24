export default function ControlPanel({
  customerTypes = [],
  difficultyLevels = [],
  customerType,
  setCustomerType,
  difficulty,
  setDifficulty,
  isLive,
  startSession,
  endSession,
  scenario,
}) {
  const safeCustomerTypes =
    customerTypes.length > 0
      ? customerTypes
      : [
          {
            id: "skeptical-store-owner",
            label: "Skeptical Store Owner",
          },
        ];

  const safeDifficultyLevels =
    difficultyLevels.length > 0
      ? difficultyLevels
      : [
          {
            id: "medium",
            label: "Medium",
          },
        ];

  return (
    <section className="simulator-control-panel">
      <label>
        Customer Type
        <select
          value={customerType}
          onChange={(event) => setCustomerType(event.target.value)}
          disabled={isLive}
        >
          {safeCustomerTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Difficulty
        <select
          value={difficulty}
          onChange={(event) => setDifficulty(event.target.value)}
          disabled={isLive}
        >
          {safeDifficultyLevels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.label}
            </option>
          ))}
        </select>
      </label>

      <button onClick={startSession} disabled={isLive}>
        Start AI Customer Call
      </button>

      <button onClick={endSession} disabled={!isLive}>
        End Call / Score Me
      </button>

      <div className="simulator-scenario-preview">
        <strong>Scenario Preview</strong>
        <span>
          Loaded customer types: {safeCustomerTypes.length} | Loaded difficulty
          levels: {safeDifficultyLevels.length}
        </span>
        {scenario?.hiddenNeed && <span>{scenario.hiddenNeed}</span>}
      </div>
    </section>
  );
}