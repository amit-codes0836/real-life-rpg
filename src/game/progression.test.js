import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialProgression,
  getSkillForQuest,
  recordQuestCompletion,
} from "./progression.js";
import { generateDailyQuests } from "./questGenerator.js";

test("a quest awards overall and skill practice XP exactly once", () => {
  const quest = {
    id: "quest-1",
    title: "Review an ML concept",
    category: "AI / ML",
    difficulty: "EASY",
    xp: 25,
  };
  const first = recordQuestCompletion(createInitialProgression(), quest, "2026-10-19T10:00:00.000Z");
  const duplicate = recordQuestCompletion(first, quest, "2026-10-19T10:01:00.000Z");

  assert.equal(first.xp, 25);
  assert.equal(first.totalXpEarned, 25);
  assert.equal(first.skillPracticeXp["AI / ML"], 25);
  assert.equal(first.history.length, 1);
  assert.equal(first.history[0].xpEarned, 25);
  assert.equal(first.history[0].completedAt, "2026-10-19T10:00:00.000Z");
  assert.equal(first.activityRecords.length, 1);
  assert.equal(first.activityRecords[0].status, "completed");
  assert.equal(duplicate, first);
});

test("completion records estimated and supplied actual duration without inventing actual time", () => {
  const quest = { id: "timed", title: "Timed task", category: "Backend", difficulty: "EASY", xp: 25, estimatedDurationMinutes: 15 };
  const withoutActual = recordQuestCompletion(createInitialProgression(), quest, "2026-10-19T10:00:00.000Z");
  assert.equal(withoutActual.activityRecords[0].estimatedDurationMinutes, 15);
  assert.equal(Object.hasOwn(withoutActual.activityRecords[0], "actualDurationMinutes"), false);

  const withActual = recordQuestCompletion(createInitialProgression(), quest, "2026-10-19T10:00:00.000Z", {
    localDate: "2026-10-19", actualDurationMinutes: "12",
  });
  assert.equal(withActual.activityRecords[0].actualDurationMinutes, 12);
  const invalid = recordQuestCompletion(createInitialProgression(), quest, "2026-10-19T10:00:00.000Z", {
    actualDurationMinutes: -4,
  });
  assert.equal(Object.hasOwn(invalid.activityRecords[0], "actualDurationMinutes"), false);
});

test("missed and abandoned outcomes are unique and never award completion rewards", async () => {
  const { recordQuestOutcome } = await import("./progression.js");
  const quest = { id: "outcome-quest", title: "Outcome quest", category: "Backend", difficulty: "HARD", xp: 70, estimatedDurationMinutes: 20 };
  const initial = createInitialProgression();
  const missed = recordQuestOutcome(initial, quest, "missed", { recordedAt: "2026-10-19T10:00:00.000Z" });
  assert.equal(missed.activityRecords[0].status, "missed");
  assert.equal(missed.xp, 0);
  assert.equal(missed.totalXpEarned, 0);
  assert.equal(missed.history.length, 0);
  assert.equal(missed.weeklyBoss, initial.weeklyBoss);
  assert.equal(recordQuestOutcome(missed, quest, "abandoned"), missed);

  const abandoned = recordQuestOutcome(initial, quest, "abandoned", {
    recordedAt: "2026-10-19T10:00:00.000Z", localDate: "2026-10-19", actualDurationMinutes: 9,
  });
  assert.equal(abandoned.activityRecords[0].status, "abandoned");
  assert.equal(abandoned.activityRecords[0].actualDurationMinutes, 9);
  assert.equal(abandoned.xp, 0);
  assert.equal(abandoned.skillPracticeXp.Backend, undefined);
  assert.equal(abandoned.history.length, 0);
});

test("quest categories safely map to existing skill names", () => {
  assert.equal(getSkillForQuest({ category: "AI / ML" }), "AI / ML");
  assert.equal(getSkillForQuest({ category: "Backend" }), "Backend");
  assert.equal(getSkillForQuest({ category: "Personal Goal" }), null);
});

test("unmapped quests still enter history and award overall XP only", () => {
  const next = recordQuestCompletion(createInitialProgression(), {
    id: "quest-general",
    title: "Make progress on a personal goal",
    category: "Personal Goal",
    difficulty: "EASY",
    xp: 25,
  }, "2026-10-19T10:00:00.000Z");

  assert.equal(next.xp, 25);
  assert.deepEqual(next.skillPracticeXp, {});
  assert.equal(next.history.length, 1);
});

test("quest generation is pure and leaves progression XP and history untouched", () => {
  const progress = {
    ...createInitialProgression(),
    xp: 90,
    totalXpEarned: 140,
    history: [{ id: "previous", title: "Previous quest", xpEarned: 50 }],
  };
  const before = structuredClone(progress);

  const quests = generateDailyQuests({
    goals: [],
    skills: {},
    assessedSkills: [],
    generation: 4,
    dateKey: "2026-10-19",
  });

  assert.equal(quests.length, 5);
  assert.deepEqual(progress, before);
});
