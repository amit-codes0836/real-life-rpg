import QuestBoard from "./QuestBoard";
import Skills from "./Skills.jsx";
import Goals from "./Goals";
import ProgressHistory from "./ProgressHistory";
import WeeklyBoss from "./WeeklyBoss";
import ActivitySummary from "./ActivitySummary.jsx";
import GameplayFeedback from "./GameplayFeedback.jsx";
import { buildActivitySummary } from "../game/activityTracking.js";

function Dashboard({
  character,
  gameStyle,
  level,
  xp,
  progression,
  completionFeedback,
  quests,
  skills,
  assessedSkills,
  goals,
  onGoalsChange,
  defaultSkills,
  onCompleteQuest,
  onRecordQuestStatus,
  onRestart,
  onAssessSkills,
  onGenerateQuests,
  gameMasterLoading,
  gameMasterError,
}) {
  const xpRequired = level * 500;

  const xpProgress = Math.min(
    (xp / xpRequired) * 100,
    100
  );
  const activity = buildActivitySummary({ quests, progression });

  return (
    <div className="app dashboard-app">

      <div className="background-glow glow-one"></div>
      <div className="background-glow glow-two"></div>

      <header className="dashboard-topbar">

        <div className="logo">
          <span>⚔</span>
          REAL-LIFE RPG
        </div>

        <div className="player-mini">
          {character.avatar}{" "}
          {character.name || "PLAYER"}
        </div>

      </header>

      <main className="dashboard">

        {/* PLAYER */}

        <section className="player-header">

          <div className="player-avatar">
            {character.avatar}
          </div>

          <div className="player-info">

            <div className="eyebrow">CHARACTER PROFILE</div>

            <h1>
              {character.name || "PLAYER"}
            </h1>

            <p>
              Your real life. Your RPG.
            </p>

          </div>

          <div className="level-box">

            <span>LEVEL</span>

            <strong>
              {level}
            </strong>

          </div>

        </section>

        {/* XP */}

        <section className="xp-card">

          <div className="xp-header">

            <span>
              EXPERIENCE
            </span>

            <strong>
              {xp} / {xpRequired} XP
            </strong>

          </div>

          <div className="xp-bar">

            <div
              className="xp-fill"
              role="progressbar"
              aria-label={`Level ${level} experience progress`}
              aria-valuemin={0}
              aria-valuemax={xpRequired}
              aria-valuenow={xp}
              style={{
                width: `${xpProgress}%`,
              }}
            />

          </div>

          <p>
            {xpRequired - xp} XP until Level{" "}
            {level + 1}
          </p>

        </section>

        <GameplayFeedback feedback={completionFeedback} />

        {/* STATS */}

        <section className="stats-grid">

          <div className="stat-card">

            <span>COMPLETED TODAY</span>

            <strong>
              {activity.today.completed}
            </strong>

          </div>

          <div className="stat-card">

            <span>CURRENT STREAK</span>

            <strong>
              🔥 {activity.week.currentStreak}
            </strong>

          </div>

          <div className="stat-card">

            <span>GAME STYLE</span>

            <strong>
              {gameStyle}
            </strong>

          </div>

          <div className="stat-card">

            <span>TOTAL XP</span>

            <strong>
              {progression.totalXpEarned}
            </strong>

          </div>

        </section>

        {/* QUESTS */}

        <QuestBoard
          quests={quests}
          onComplete={onCompleteQuest}
          onRecordOutcome={onRecordQuestStatus}
          recentlyCompletedQuestId={completionFeedback?.questId}
          onGenerate={onGenerateQuests}
          generating={gameMasterLoading}
          generationError={gameMasterError}
        />

        <WeeklyBoss boss={progression.weeklyBoss} damageFeedback={completionFeedback?.bossDamage || 0} />

        <ActivitySummary activity={activity} defaultSkills={defaultSkills} />

        {/* SKILLS */}

        <Skills
          skills={skills}
          defaultSkills={defaultSkills}
          assessedSkills={assessedSkills}
          practiceXp={progression.skillPracticeXp}
        />

        <div className="assessment-action">
          <p>Get a quick, quiz-based estimate of five skills.</p>
          <button className="primary-button" onClick={onAssessSkills}>
            ASSESS SKILLS
          </button>
        </div>

        <ProgressHistory progression={progression} defaultSkills={defaultSkills} />

        {/* GOALS */}

        <Goals goals={goals} onGoalsChange={onGoalsChange} />

        {/* GAME MASTER */}

        <section className="game-master">

          <div className="gm-icon">
            ✦
          </div>

          <div>

            <div className="eyebrow">
              AI GAME MASTER
            </div>

            <h2>
              GEMINI QUEST SUGGESTIONS
            </h2>

            <p>
              The Game Master uses your goals, assessed weaker skills, recent quest history, and this week’s boss status to suggest focused challenges. Generated suggestions are validated before they enter your quest board; XP and rewards remain controlled by the game.
            </p>

          </div>

        </section>

        <button
          className="reset-button"
          onClick={onRestart}
        >
          ← RESTART CHARACTER
        </button>

      </main>

    </div>
  );
}

export default Dashboard;
