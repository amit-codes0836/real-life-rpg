import test from "node:test";
import assert from "node:assert/strict";
import { createInitialProgression, recordQuestCompletion } from "./progression.js";
import {
  damageWeeklyBoss,
  loadWeeklyBossState,
  persistWeeklyBossState,
} from "./bossBattles.js";

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("quest completion damages once, and boss defeat rewards XP and badge once", () => {
  const now = new Date(2026, 9, 19, 12);
  const completedAt = now.toISOString();
  const boss = loadWeeklyBossState(null, now);
  let progression = createInitialProgression(boss);

  for (let index = 0; index < 6; index += 1) {
    progression = recordQuestCompletion(progression, {
      id: `hard-quest-${index}`,
      title: `Hard quest ${index}`,
      category: "AI / ML",
      difficulty: "HARD",
      xp: 50,
    }, completedAt);
  }

  assert.equal(progression.weeklyBoss.currentHp, 0);
  assert.equal(progression.weeklyBoss.defeated, true);
  assert.equal(progression.weeklyBoss.rewardClaimed, true);
  assert.equal(progression.totalXpEarned, 500);
  assert.equal(progression.history.length, 6);
  assert.equal(progression.history[0].bossBonusXpEarned, 200);
  assert.equal(progression.history[0].badgeEarned.id, progression.weeklyBoss.badge.id);
  assert.equal(progression.skillPracticeXp["AI / ML"], 300);

  const duplicateCompletion = recordQuestCompletion(progression, {
    id: "hard-quest-5",
    title: "Hard quest 5",
    category: "AI / ML",
    difficulty: "HARD",
    xp: 50,
  }, completedAt);
  assert.equal(duplicateCompletion, progression);

  const postDefeatHit = damageWeeklyBoss(progression.weeklyBoss, {
    id: "after-defeat",
    difficulty: "HARD",
  }, completedAt);
  assert.equal(postDefeatHit.bonusXp, 0);
  assert.equal(postDefeatHit.damage, 0);
});

test("boss damage persists through reload and a new week selects a fresh boss while retaining badges", () => {
  const storage = createMemoryStorage();
  const weekOne = new Date(2026, 9, 19, 12);
  const firstBoss = loadWeeklyBossState(storage, weekOne);
  const damaged = damageWeeklyBoss(firstBoss, { id: "one", difficulty: "MEDIUM" }, weekOne.toISOString()).boss;
  persistWeeklyBossState(damaged, storage);

  const reloaded = loadWeeklyBossState(storage, weekOne);
  assert.equal(reloaded.id, firstBoss.id);
  assert.equal(reloaded.currentHp, firstBoss.targetHp - 30);

  let winningBoss = reloaded;
  for (let index = 0; index < 5; index += 1) {
    winningBoss = damageWeeklyBoss(winningBoss, {
      id: `hard-${index}`,
      difficulty: "HARD",
    }, weekOne.toISOString()).boss;
  }
  persistWeeklyBossState(winningBoss, storage);
  const defeatedReload = loadWeeklyBossState(storage, weekOne);
  assert.equal(defeatedReload.defeated, true);
  assert.equal(defeatedReload.rewardClaimed, true);
  assert.equal(defeatedReload.earnedRewards.length, 1);

  const weekTwo = new Date(2026, 9, 26, 12);
  const nextBoss = loadWeeklyBossState(storage, weekTwo);
  assert.notEqual(nextBoss.id, firstBoss.id);
  assert.equal(nextBoss.currentHp, nextBoss.targetHp);
  assert.deepEqual(nextBoss.earnedRewards.map((reward) => reward.badge.id), [firstBoss.badge.id]);
});

test("no active boss safely means a quest causes no boss damage or reward", () => {
  const result = damageWeeklyBoss(null, { id: "quest-without-boss", difficulty: "EASY" });
  assert.equal(result.boss, null);
  assert.equal(result.damage, 0);
  assert.equal(result.bonusXp, 0);
  assert.equal(result.badgeAwarded, null);
});
