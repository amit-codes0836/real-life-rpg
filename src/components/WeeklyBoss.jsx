function WeeklyBoss({ boss, damageFeedback = 0 }) {
  if (!boss) {
    return (
      <section className="dashboard-section weekly-boss-section" aria-labelledby="weekly-boss-title">
        <div className="eyebrow">WEEKLY CHALLENGE</div>
        <h2 id="weekly-boss-title">WEEKLY BOSS</h2>
        <div className="weekly-boss-empty">No active boss is available right now. Your quest progress is still safe.</div>
      </section>
    );
  }

  const percentageDefeated = Math.max(0, Math.min(100, Math.round(
    ((boss.targetHp - boss.currentHp) / boss.targetHp) * 100
  )));
  const earnedBadgeIds = new Set(
    boss.earnedRewards.map((reward) => reward.badge?.id)
  );
  const badgeEarned = earnedBadgeIds.has(boss.badge.id);

  return (
    <section className="dashboard-section weekly-boss-section" aria-labelledby="weekly-boss-title">
      <div className="section-heading weekly-boss-heading">
        <div>
          <div className="eyebrow">WEEK OF {boss.weekKey}</div>
          <h2 id="weekly-boss-title">WEEKLY BOSS</h2>
        </div>
        <span className={`boss-status${boss.defeated ? " defeated" : ""}`}>
          {boss.defeated ? "DEFEATED" : "ACTIVE"}
        </span>
      </div>

      <article className={`weekly-boss-card${boss.defeated ? " boss-defeated" : ""}`}>
        <div className="boss-identity">
          <div className="boss-avatar" aria-hidden="true">{boss.badge.icon}</div>
          <div className="boss-copy">
            <h3>{boss.name}</h3>
            <p>{boss.description}</p>
          </div>
          <div className={`boss-badge${badgeEarned ? " earned" : ""}`} aria-label={badgeEarned ? `${boss.badge.name} earned` : `${boss.badge.name} reward`}>
            <span>{boss.badge.icon}</span>
            <small>{badgeEarned ? "EARNED" : boss.badge.name}</small>
          </div>
        </div>

        <div className="boss-target-row">
          <span>TARGET {boss.targetHp} HP</span>
          <strong>{boss.currentHp} HP REMAINING</strong>
        </div>
        <div
          className="boss-hp-track"
          role="progressbar"
          aria-label={`${boss.name} health remaining`}
          aria-valuemin={0}
          aria-valuemax={boss.targetHp}
          aria-valuenow={boss.currentHp}
          aria-valuetext={`${boss.currentHp} of ${boss.targetHp} HP remaining`}
        >
          <div className={`boss-hp-fill${damageFeedback > 0 ? " boss-damage-flash" : ""}`} style={{ width: `${(boss.currentHp / boss.targetHp) * 100}%` }} />
        </div>
        <div className="boss-progress-row">
          <span>{percentageDefeated}% defeated</span>
          {damageFeedback > 0
            ? <span className="boss-damage-feedback" role="status" aria-live="polite">−{damageFeedback} HP this quest</span>
            : <span>QUESTS DAMAGE THE BOSS</span>}
        </div>

        {boss.defeated ? (
          <div className="boss-victory" role="status">
            <strong>WEEKLY BOSS DEFEATED</strong>
            <span>+{boss.rewardXp} bonus XP and the {boss.badge.name} badge earned.</span>
          </div>
        ) : (
          <p className="boss-reward-preview">
            Defeat the boss for <strong>+{boss.rewardXp} XP</strong> and the <strong>{boss.badge.name}</strong> badge.
          </p>
        )}

        {boss.earnedRewards.length > 0 && (
          <div className="earned-badges" aria-label="Earned weekly boss badges">
            <span className="earned-badges-label">EARNED BADGES</span>
            <div className="earned-badge-list">
              {boss.earnedRewards.map((reward) => (
                <span className="earned-badge" key={`${reward.weekKey}-${reward.badge.id}`} title={`${reward.badge.name} · ${reward.weekKey}`}>
                  {reward.badge.icon} {reward.badge.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </article>
    </section>
  );
}

export default WeeklyBoss;
