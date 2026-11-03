import test from "node:test";
import assert from "node:assert/strict";
import { createInitialProgression, recordQuestCompletion } from "./progression.js";
import { loadWeeklyBossState } from "./bossBattles.js";
import { buildCompletionFeedback } from "./gameplayFeedback.js";

const completionTime = "2026-11-03T10:00:00.000Z";
const quest = { id: "feedback-quest", title: "Practice one route", category: "Backend", difficulty: "EASY", xp: 25 };

test("completion feedback reflects the actual progression return and skill practice increase", () => {
  const before = createInitialProgression(loadWeeklyBossState(null, new Date(completionTime)));
  const after = recordQuestCompletion(before, quest, completionTime);
  const feedback = buildCompletionFeedback(before, after, quest);

  assert.equal(feedback.xpEarned, 25);
  assert.equal(feedback.questXp, 25);
  assert.equal(feedback.bossBonusXp, 0);
  assert.equal(feedback.skill, "Backend");
  assert.equal(feedback.skillPracticeXp, 25);
  assert.equal(feedback.skillPracticeTotal, 25);
  assert.equal(feedback.bossDamage, 20);
  assert.equal(feedback.levelUp, false);
});

test("level-up and boss bonus feedback appear only when progression records them", () => {
  const weeklyBoss = { ...loadWeeklyBossState(null, new Date(completionTime)), currentHp: 20 };
  const before = { ...createInitialProgression(weeklyBoss), xp: 475 };
  const after = recordQuestCompletion(before, quest, completionTime);
  const feedback = buildCompletionFeedback(before, after, quest);

  assert.equal(after.level, 2);
  assert.equal(feedback.levelUp, true);
  assert.equal(feedback.level, 2);
  assert.equal(feedback.bossBonusXp, weeklyBoss.rewardXp);
  assert.equal(feedback.xpEarned, 25 + weeklyBoss.rewardXp);
  assert.equal(feedback.bossDamage, 20);
  assert.equal(buildCompletionFeedback(before, before, quest), null);
});

test("personal goal completions do not display nonexistent skill practice progress", () => {
  const personalQuest = { ...quest, id: "personal", category: "Personal Goal" };
  const before = createInitialProgression();
  const after = recordQuestCompletion(before, personalQuest, completionTime);
  const feedback = buildCompletionFeedback(before, after, personalQuest);
  assert.equal(feedback.skill, null);
  assert.equal(feedback.skillPracticeXp, 0);
});
