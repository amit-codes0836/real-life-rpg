function ActivitySummary({ activity, defaultSkills }) {
  const { today, week } = activity;
  const completionPercent = week.completionRate === null
    ? "—"
    : `${Math.round(week.completionRate * 100)}%`;
  const practice = defaultSkills
    .map((skill) => ({ skill, xp: week.skillPracticeXp[skill] || 0 }))
    .filter(({ xp }) => xp > 0)
    .sort((left, right) => right.xp - left.xp);

  return (
    <section className="dashboard-section activity-summary" aria-labelledby="activity-summary-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">RECORDED PLAY</div>
          <h2 id="activity-summary-title">ACTIVITY</h2>
        </div>
      </div>

      <div className="activity-summary-grid">
        <article className="activity-period-card">
          <h3>Today</h3>
          <dl>
            <div><dt>Completed</dt><dd>{today.completed}</dd></div>
            <div><dt>Missed</dt><dd>{today.missed}</dd></div>
            <div><dt>Abandoned</dt><dd>{today.abandoned}</dd></div>
            <div><dt>Pending</dt><dd>{today.pending}</dd></div>
            <div><dt>XP earned today</dt><dd>{today.xpEarned}</dd></div>
            <div><dt>Actual time recorded</dt><dd>
              {today.timedOutcomeCount > 0 ? `${today.actualMinutes} min` : "Not recorded"}
            </dd></div>
          </dl>
        </article>

        <article className="activity-period-card">
          <h3>Last 7 local calendar days</h3>
          <dl>
            <div><dt>Completed quests</dt><dd>{week.completed}</dd></div>
            <div><dt>Missed</dt><dd>{week.missed}</dd></div>
            <div><dt>Abandoned</dt><dd>{week.abandoned}</dd></div>
            <div><dt>Completion rate</dt><dd>{completionPercent}</dd></div>
            <div><dt>Rate denominator</dt><dd>{week.outcomeCount} recorded outcomes</dd></div>
            <div><dt>XP earned</dt><dd>{week.xpEarned}</dd></div>
            <div><dt>Active days</dt><dd>{week.activeDays} / 7</dd></div>
            <div><dt>Current streak</dt><dd>{week.currentStreak} days</dd></div>
          </dl>
          <div className="activity-skill-progress">
            <h4>Skill practice this week</h4>
            {practice.length ? (
              <ul>{practice.map(({ skill, xp }) => <li key={skill}><span>{skill}</span><strong>{xp} XP</strong></li>)}</ul>
            ) : <p>No recorded skill practice this week.</p>}
          </div>
        </article>
      </div>
      <p className="activity-rate-note">
        Completion rate = completed ÷ (completed + missed + abandoned). Pending quests are excluded.
      </p>
    </section>
  );
}

export default ActivitySummary;
