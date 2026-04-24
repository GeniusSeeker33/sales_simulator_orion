export default function ControlPanel({
  customerTypes,
  difficultyLevels,
  customerType,
  setCustomerType,
  difficulty,
  setDifficulty,
  isLive,
  startSession,
  endSession,
  scenario,
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
          {customerTypes.map((type) => (
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
          {difficultyLevels.map((level) => (
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

      {scenario && (
        <div className="simulator-scenario-preview">
          <strong>Scenario Preview</strong>
          <span>{scenario.hiddenNeed}</span>
        </div>
      )}
    </section>
  );
}