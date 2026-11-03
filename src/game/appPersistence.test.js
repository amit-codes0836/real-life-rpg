import test from "node:test";
import assert from "node:assert/strict";
import { createInitialProgression, recordQuestCompletion } from "./progression.js";
import {
  GAME_STATE_STORAGE_KEY,
  loadGameState,
  persistGameState,
} from "./appPersistence.js";

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("player, assessment, quest, progression, and boss data survive a refresh", () => {
  const storage = createMemoryStorage();
  const date = new Date(2026, 9, 19, 12);
  const state = loadGameState(storage, date);
  const quest = state.quests[0];
  const completed = {
    ...state,
    showDashboard: true,
    character: { name: "Ranger", age: "", avatar: "🧙" },
    goals: ["Learn backend"],
    skills: { ...state.skills, Backend: 73 },
    assessedSkills: ["Backend"],
    progression: recordQuestCompletion(state.progression, quest, date.toISOString()),
    quests: state.quests.map((item) => item.id === quest.id ? { ...item, completed: true } : item),
  };

  assert.equal(persistGameState(completed, storage), true);
  const reloaded = loadGameState(storage, date);

  assert.deepEqual(reloaded.character, completed.character);
  assert.deepEqual(reloaded.assessedSkills, ["Backend"]);
  assert.equal(reloaded.skills.Backend, 73);
  assert.deepEqual(reloaded.goals, ["Learn backend"]);
  assert.equal(reloaded.progression.xp, completed.progression.xp);
  assert.equal(reloaded.progression.level, completed.progression.level);
  assert.deepEqual(reloaded.progression.skillPracticeXp, completed.progression.skillPracticeXp);
  assert.deepEqual(reloaded.progression.history, completed.progression.history);
  assert.deepEqual(reloaded.progression.completedQuestIds, completed.progression.completedQuestIds);
  assert.deepEqual(reloaded.progression.activityRecords, completed.progression.activityRecords);
  assert.equal(reloaded.quests.find((item) => item.id === quest.id).completed, true);
  assert.deepEqual(reloaded.progression.weeklyBoss, completed.progression.weeklyBoss);
});

test("reloaded completion cannot award duplicate XP, practice XP, history, or boss damage", () => {
  const storage = createMemoryStorage();
  const date = new Date(2026, 9, 19, 12);
  const state = loadGameState(storage, date);
  const quest = state.quests[0];
  const completedProgression = recordQuestCompletion(state.progression, quest, date.toISOString());
  const completed = {
    ...state,
    progression: completedProgression,
    quests: state.quests.map((item) => item.id === quest.id ? { ...item, completed: true } : item),
  };
  persistGameState(completed, storage);

  const reloaded = loadGameState(storage, date);
  const duplicate = recordQuestCompletion(reloaded.progression, quest, date.toISOString());
  assert.equal(duplicate, reloaded.progression);
  assert.equal(reloaded.progression.history.filter((entry) => entry.id === quest.id).length, 1);
  assert.deepEqual(reloaded.progression.skillPracticeXp, completedProgression.skillPracticeXp);
  assert.deepEqual(reloaded.progression.weeklyBoss.processedQuestIds, completedProgression.weeklyBoss.processedQuestIds);
});

test("quest generation does not change persisted XP or history", () => {
  const storage = createMemoryStorage();
  const state = loadGameState(storage, new Date(2026, 9, 19, 12));
  const snapshot = structuredClone(state.progression);
  const nextGeneration = {
    ...state,
    questGeneration: state.questGeneration + 1,
    quests: [],
  };
  persistGameState(nextGeneration, storage);
  const reloaded = loadGameState(storage, new Date(2026, 9, 19, 12));

  assert.equal(reloaded.progression.totalXpEarned, snapshot.totalXpEarned);
  assert.deepEqual(reloaded.progression.history, snapshot.history);
});

test("invalid or partial saved data is normalized without crashing", () => {
  const storage = createMemoryStorage({
    [GAME_STATE_STORAGE_KEY]: JSON.stringify({
      character: { name: 42, avatar: null },
      goals: ["  ", null, "A valid goal"],
      skills: { Coding: "not-a-score", Backend: 125 },
      assessedSkills: ["Backend", "Unknown"],
      quests: [{ id: "same", title: "One" }, { id: "same", title: "Duplicate" }, null],
      progression: {
        xp: "bad",
        level: 0,
        totalXpEarned: -20,
        skillPracticeXp: { Coding: "bad", Unknown: 400 },
        history: [{ id: "done", xpEarned: 10 }, { id: "done", xpEarned: 10 }],
        completedQuestIds: ["done"],
        weeklyBoss: { defeated: "maybe", processedQuestIds: "bad" },
      },
    }),
  });

  const state = loadGameState(storage, new Date(2026, 9, 19, 12));
  assert.equal(state.character.name, "");
  assert.equal(state.skills.Coding, 50);
  assert.equal(state.skills.Backend, 100);
  assert.deepEqual(state.goals, ["A valid goal"]);
  assert.equal(state.quests.length, 1);
  assert.equal(state.progression.history.length, 1);
  assert.equal(state.progression.level, 1);
  assert.equal(state.progression.xp, 0);
  assert.equal(state.progression.weeklyBoss.currentHp > 0, true);

  const malformedJson = loadGameState(createMemoryStorage({ [GAME_STATE_STORAGE_KEY]: "{" }));
  assert.equal(malformedJson.character.name, "");
  assert.equal(malformedJson.progression.level, 1);
  assert.ok(malformedJson.quests.length > 0);
});

test("old saves derive completed outcomes from history without changing existing rewards", () => {
  const storage = createMemoryStorage({
    [GAME_STATE_STORAGE_KEY]: JSON.stringify({
      character: { name: "Legacy" },
      quests: [{ id: "legacy-done", title: "Old completion", completed: true }],
      progression: {
        xp: 42,
        level: 2,
        totalXpEarned: 542,
        skillPracticeXp: { Backend: 42 },
        history: [{
          id: "legacy-done", title: "Old completion", category: "Backend", difficulty: "EASY",
          xpEarned: 42, bossBonusXpEarned: 0, completedAt: "2026-10-19T10:00:00.000Z",
        }],
      },
    }),
  });
  const state = loadGameState(storage, new Date(2026, 9, 19, 12));
  assert.equal(state.progression.xp, 42);
  assert.equal(state.progression.totalXpEarned, 542);
  assert.deepEqual(state.progression.skillPracticeXp, { Backend: 42 });
  assert.equal(state.progression.activityRecords.length, 1);
  assert.equal(state.progression.activityRecords[0].status, "completed");
  assert.equal(state.progression.activityRecords[0].localDate, "2026-10-19");
  assert.equal(state.quests[0].outcomeStatus, "completed");
});

test("restart initialization clears player progression but retains the active boss", () => {
  const state = loadGameState(createMemoryStorage(), new Date(2026, 9, 19, 12));
  const progressed = recordQuestCompletion(state.progression, state.quests[0], "2026-10-19T12:00:00.000Z");
  const restarted = createInitialProgression(progressed.weeklyBoss);

  assert.equal(restarted.xp, 0);
  assert.equal(restarted.level, 1);
  assert.equal(restarted.totalXpEarned, 0);
  assert.deepEqual(restarted.skillPracticeXp, {});
  assert.deepEqual(restarted.history, []);
  assert.deepEqual(restarted.completedQuestIds, []);
  assert.deepEqual(restarted.weeklyBoss, progressed.weeklyBoss);
});

test("new week rolls the boss while preserving earned player progression and old badge", () => {
  const storage = createMemoryStorage();
  const weekOne = new Date(2026, 9, 19, 12);
  const initial = loadGameState(storage, weekOne);
  let progression = initial.progression;
  let quest = { id: "boss-win-1", title: "Damage", category: "Coding", difficulty: "HARD", xp: 50 };
  while (!progression.weeklyBoss.defeated) {
    progression = recordQuestCompletion(progression, quest, weekOne.toISOString());
    quest = { ...quest, id: `${quest.id}-next` };
  }
  const saved = { ...initial, showDashboard: true, progression };
  persistGameState(saved, storage);
  const weekTwo = new Date(2026, 9, 26, 12);
  const reloaded = loadGameState(storage, weekTwo);

  assert.notEqual(reloaded.progression.weeklyBoss.id, progression.weeklyBoss.id);
  assert.equal(reloaded.progression.weeklyBoss.currentHp, reloaded.progression.weeklyBoss.targetHp);
  assert.equal(reloaded.progression.weeklyBoss.defeated, false);
  assert.equal(reloaded.progression.totalXpEarned, progression.totalXpEarned);
  assert.deepEqual(
    reloaded.progression.weeklyBoss.earnedRewards.map((reward) => reward.badge.id),
    [progression.weeklyBoss.badge.id],
  );
});
