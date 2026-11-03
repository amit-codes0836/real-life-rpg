const HISTORY_LIMIT = 8;

function formatCompletionTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Completion time unavailable"
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function ProgressHistory({ progression, defaultSkills }) {
  const recentHistory = progression.history.slice(0, HISTORY_LIMIT);
  const practicedSkills = defaultSkills
    .map((skill) => ({ skill, xp: progression.skillPracticeXp[skill] || 0 }))
    .filter(({ xp }) => xp > 0)
    .sort((left, right) => right.xp - left.xp);

  return (
    <section className="dashboard-section progress-history" aria-labelledby="progress-history-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">YOUR JOURNEY</div>
          <h2 id="progress-history-title">PROGRESS HISTORY</h2>
        </div>
      </div>

      <div className="progress-summary">
        <article className="progress-summary-card">
          <span>TOTAL XP EARNED</span>
          <strong>{progression.totalXpEarned}</strong>
        </article>
        <article className="progress-summary-card">
          <span>QUESTS COMPLETED</span>
          <strong>{progression.history.length}</strong>
        </article>
        <article className="progress-summary-card progress-practice-card">
          <span>SKILL PRACTICE XP</span>
          {practicedSkills.length > 0 ? (
            <ul>
              {practicedSkills.map(({ skill, xp }) => (
                <li key={skill}><span>{skill}</span><strong>{xp} XP</strong></li>
              ))}
            </ul>
          ) : (
            <p>No skill practice XP yet.</p>
          )}
        </article>
      </div>

      <div className="progress-history-list" aria-live="polite">
        {recentHistory.length > 0 ? (
          recentHistory.map((entry) => (
            <article className="progress-history-entry" key={`${entry.id}-${entry.completedAt}`}>
              <div className="progress-history-entry-main">
                <h3>{entry.title}</h3>
                <p>{entry.category} <span>·</span> {entry.difficulty}</p>
                <time dateTime={entry.completedAt}>{formatCompletionTime(entry.completedAt)}</time>
              </div>
              <div className="progress-history-rewards">
                <strong className="progress-history-xp">+{entry.xpEarned + (entry.bossBonusXpEarned || 0)} XP</strong>
                {entry.bossBonusXpEarned > 0 && (
                  <small>Boss bonus +{entry.bossBonusXpEarned} XP</small>
                )}
                {entry.badgeEarned && (
                  <small>{entry.badgeEarned.icon} {entry.badgeEarned.name}</small>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="progress-history-empty">
            <strong>Your progress starts with your first quest.</strong>
            <p>Completed quests and their XP rewards will appear here.</p>
          </div>
        )}
      </div>

      {progression.history.length > HISTORY_LIMIT && (
        <p className="progress-history-note">
          Showing the {HISTORY_LIMIT} most recent of {progression.history.length} completed quests.
        </p>
      )}
    </section>
  );
}

export default ProgressHistory;
