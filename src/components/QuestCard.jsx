function QuestCard({ quest, onComplete, onRecordOutcome, recentlyCompleted = false }) {
  const isOptionalChallenge = quest.optionalLongerChallenge === true;
  const status = quest.outcomeStatus || (quest.completed ? "completed" : "pending");
  const isPending = status === "pending";
  const actualTime = (event) => {
    const input = event?.currentTarget?.closest(".quest-mission")?.querySelector(".quest-actual-time");
    if (!input || input.value === "") return "";
    if (!input.checkValidity()) {
      input.reportValidity();
      return null;
    }
    return input.value;
  };
  const instructions = Array.isArray(quest.instructions)
    ? quest.instructions.filter((step) => typeof step === "string" && step.trim())
    : [];
  const successCriteria = Array.isArray(quest.successCriteria)
    ? quest.successCriteria.filter((criterion) => typeof criterion === "string" && criterion.trim())
    : [];
  const skillImpact = quest.skillImpact && typeof quest.skillImpact === "object"
    ? quest.skillImpact
    : null;
  const skillName = typeof skillImpact?.skill === "string" ? skillImpact.skill.trim() : "";
  const skillImpactType = typeof skillImpact?.impact === "string" ? skillImpact.impact.trim() : "";
  const skillImpactExplanation = typeof skillImpact?.explanation === "string"
    ? skillImpact.explanation.trim()
    : "";

  return (
    <article className={`quest quest-mission${!isPending ? ` ${status}` : ""}${isOptionalChallenge ? " quest-optional" : ""}${recentlyCompleted ? " quest-completion-flash" : ""}`}>
      <button
        className="quest-check"
        type="button"
        onClick={(event) => {
          const minutes = actualTime(event);
          if (isPending && minutes !== null) onComplete(quest.id, minutes);
        }}
        disabled={!isPending}
        aria-label={status === "completed" ? `Completed: ${quest.title}` : `Complete quest: ${quest.title}`}
        aria-pressed={status === "completed"}
      >
        {status === "completed" ? "✓" : ""}
      </button>

      <div className="quest-content">
        <div className="quest-heading">
          <div className="quest-title-group">
            <span className={`quest-status${isOptionalChallenge ? " optional" : " required"}`}>
              {isOptionalChallenge ? "Optional challenge" : "Required mission"}
            </span>
            <span className={`quest-outcome-status ${status}`}>{status}</span>
            <h3>{quest.title}</h3>
          </div>
          <div className="quest-xp" aria-label={`${quest.xp} experience points`}>
            +{quest.xp} XP
          </div>
        </div>

        {quest.reason && <p className="quest-reason">{quest.reason}</p>}

        <div className="quest-meta" aria-label="Quest details">
          {quest.category && <span className="quest-category">{quest.category}</span>}
          {quest.difficulty && <span className="quest-difficulty">{quest.difficulty}</span>}
          {Number.isFinite(quest.estimatedDurationMinutes) && (
            <span className="quest-duration">{quest.estimatedDurationMinutes} min</span>
          )}
        </div>

        {typeof quest.objective === "string" && quest.objective.trim() && (
          <section className="quest-detail quest-objective" aria-label="Objective">
            <h4>Objective</h4>
            <p>{quest.objective}</p>
          </section>
        )}

        {instructions.length > 0 && (
          <section className="quest-detail" aria-label="Mission steps">
            <h4>Mission steps</h4>
            <ol className="quest-instructions">
              {instructions.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}
            </ol>
          </section>
        )}

        {successCriteria.length > 0 && (
          <section className="quest-detail quest-success" aria-label="Success criteria">
            <h4>Success criteria</h4>
            <ul>
              {successCriteria.map((criterion, index) => (
                <li key={`${index}-${criterion}`}>{criterion}</li>
              ))}
            </ul>
          </section>
        )}

        {skillImpact && (
          <section className="quest-skill-impact" aria-label="Skill impact">
            <span className="quest-skill-label">Skill impact</span>
            {skillName && <strong>{skillName}</strong>}
            {skillImpactType && <span className="quest-skill-type">{skillImpactType}</span>}
            {skillImpactExplanation && <p>{skillImpactExplanation}</p>}
          </section>
        )}
      </div>
      {isPending && (
        <div className="quest-outcome-controls" aria-label={`Record outcome for ${quest.title}`}>
          <label>
            Actual minutes <span>(optional, 1–1440)</span>
            <input className="quest-actual-time" type="number" min="1" max="1440" step="1" inputMode="numeric" placeholder="Not recorded" />
          </label>
          <div className="quest-outcome-buttons">
            <button className="quest-outcome-button missed" type="button" onClick={() => onRecordOutcome?.(quest.id, "missed")}>
              Mark missed
            </button>
            <button className="quest-outcome-button abandoned" type="button" onClick={(event) => {
              const minutes = actualTime(event);
              if (minutes !== null) onRecordOutcome?.(quest.id, "abandoned", minutes);
            }}>
              Abandon
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default QuestCard;
