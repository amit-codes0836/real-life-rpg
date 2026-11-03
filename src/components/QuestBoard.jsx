import QuestCard from "./QuestCard";

function QuestBoard({
  quests,
  onComplete,
  onRecordOutcome,
  recentlyCompletedQuestId,
  onGenerate,
  generating = false,
  generationError = "",
}) {
  const completedQuests = quests.filter(
    (quest) => quest.completed
  ).length;

  return (
    <section className="dashboard-section">

      <div className="section-heading">

        <div>
          <div className="eyebrow">
            TODAY
          </div>

          <h2>
            DAILY QUESTS
          </h2>
        </div>

        <div className="quest-board-actions">
          <span className="quest-count">
            {completedQuests}/{quests.length}
          </span>
          <button
            className="generate-quests-button"
            type="button"
            onClick={onGenerate}
            disabled={generating}
            aria-busy={generating}
          >
            {generating ? "CONSULTING GAME MASTER…" : "GENERATE NEW QUESTS"}
          </button>
        </div>

      </div>

      {generationError && (
        <p className="game-master-error" role="alert">{generationError}</p>
      )}
      <p className="game-master-status" aria-live="polite">
        {generating ? "Building suggestions from your current progress…" : "Suggestions do not award XP. XP is earned only by completing a quest."}
      </p>

      <div className="quest-list">

        {quests.map((quest) => (
          <QuestCard
            key={quest.id}
            quest={quest}
            onComplete={onComplete}
            onRecordOutcome={onRecordOutcome}
            recentlyCompleted={quest.id === recentlyCompletedQuestId}
          />
        ))}

      </div>

    </section>
  );
}

export default QuestBoard;
