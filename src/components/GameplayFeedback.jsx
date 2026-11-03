function GameplayFeedback({ feedback }) {
  if (!feedback) return null;

  return (
    <div className="gameplay-feedback" role="status" aria-live="polite" aria-atomic="true">
      <span className="gameplay-feedback-icon" aria-hidden="true">✦</span>
      <div className="gameplay-feedback-copy">
        <strong>QUEST COMPLETE</strong>
        <span className="gameplay-feedback-xp">+{feedback.xpEarned} XP earned</span>
        {feedback.bossBonusXp > 0 && (
          <span className="gameplay-feedback-detail">Includes +{feedback.bossBonusXp} weekly boss bonus</span>
        )}
        {feedback.skill && feedback.skillPracticeXp > 0 && (
          <span className="gameplay-feedback-detail">
            {feedback.skill}: +{feedback.skillPracticeXp} practice XP · {feedback.skillPracticeTotal} total
          </span>
        )}
        {feedback.bossDamage > 0 && (
          <span className="gameplay-feedback-detail">Weekly boss took {feedback.bossDamage} damage</span>
        )}
        {feedback.levelUp && (
          <span className="level-up-message">LEVEL UP · LEVEL {feedback.level}</span>
        )}
      </div>
    </div>
  );
}

export default GameplayFeedback;
