import test from "node:test";
import assert from "node:assert/strict";
import { buildPlayerContext } from "./playerContext.js";

const activity = (status, index, difficulty = "MEDIUM") => ({
  title: `${status} activity ${index}`,
  status,
  difficulty,
  category: "Coding",
  completedAt: status === "completed" ? `2026-10-${String(index + 1).padStart(2, "0")}T12:00:00.000Z` : undefined,
});

test("context includes bounded character, goals, assessed skills, progress, and time", () => {
  const context = buildPlayerContext({
    character: { name: "  Ranger  ", age: "private" },
    goals: [" Ship an API ", "", 42],
    skills: { Backend: 32, Coding: 84, Fitness: 10, Unknown: 1 },
    assessedSkills: ["Backend", "Coding", "Unknown"],
    progression: { level: 4, xp: 120, totalXpEarned: 1620 },
    availableTimeMinutes: 30,
  });

  assert.deepEqual(context.character, { displayName: "Ranger" });
  assert.deepEqual(context.goals, ["Ship an API"]);
  assert.deepEqual(context.skills.assessed, [
    { skill: "Backend", score: 32 },
    { skill: "Coding", score: 84 },
  ]);
  assert.equal(context.skills.unassessed.includes("Fitness"), true);
  assert.equal(context.skills.unassessed.includes("Unknown"), false);
  assert.deepEqual(context.progression, { level: 4, xp: 120, totalXpEarned: 1620, skillPracticeXp: {} });
  assert.equal(context.availableTimeMinutes, 30);
  assert.equal(Object.hasOwn(context.character, "age"), false);
});

test("active quest titles are deduplicated, bounded, and omit completed quests", () => {
  const context = buildPlayerContext({
    currentQuests: [
      { title: "Current task", completed: false },
      { title: "Finished task", completed: true },
      { title: " Current task ", completed: false },
      ...Array.from({ length: 15 }, (_, index) => ({ title: `Active ${index}`, completed: false })),
    ],
  });

  assert.equal(context.activeQuestTitles.includes("Finished task"), false);
  assert.equal(context.activeQuestTitles.length, 10);
  assert.equal(context.activeQuestTitles.filter((title) => title === "Current task").length, 1);
});

test("completion consistency counts only explicit recent completed and missed outcomes", () => {
  const context = buildPlayerContext({
    activityLog: [
      activity("completed", 0),
      activity("missed", 1),
      activity("completed", 2),
      activity("available", 3),
      { status: "unknown", title: "Ignore this" },
    ],
  });

  assert.equal(context.consistency.completedCount, 2);
  assert.equal(context.consistency.missedCount, 1);
  assert.equal(context.consistency.outcomeCount, 3);
  assert.equal(context.consistency.completionRate, 2 / 3);
  assert.deepEqual(context.consistency.missedQuests, [
    { title: "missed activity 1", difficulty: "MEDIUM" },
  ]);
});

test("difficulty guidance stays neutral without enough outcomes and does not react to one miss", () => {
  const noHistory = buildPlayerContext({ activityLog: [activity("missed", 0)] });
  const mixedHistory = buildPlayerContext({ activityLog: [
    activity("completed", 0),
    activity("completed", 1),
    activity("completed", 2),
    activity("missed", 3),
    activity("missed", 4),
  ] });

  assert.equal(noHistory.consistency.difficultyGuidance, "hold");
  assert.equal(mixedHistory.consistency.difficultyGuidance, "hold");
});

test("difficulty guidance adjusts gradually only after multiple consistent outcomes", () => {
  const strong = buildPlayerContext({ activityLog: [
    activity("completed", 0), activity("completed", 1), activity("completed", 2),
    activity("completed", 3), activity("missed", 4), activity("completed", 5),
  ] });
  const struggling = buildPlayerContext({ activityLog: [
    activity("missed", 0), activity("missed", 1), activity("completed", 2),
    activity("missed", 3), activity("missed", 4),
  ] });

  assert.equal(strong.consistency.difficultyGuidance, "slight_increase");
  assert.equal(struggling.consistency.difficultyGuidance, "slight_decrease");
});

test("available time and player inputs are normalized and bounded", () => {
  const context = buildPlayerContext({
    goals: Array.from({ length: 30 }, (_, index) => `Goal ${index}`),
    availableTimeMinutes: 99999,
    activityLog: Array.from({ length: 40 }, (_, index) => activity("missed", index)),
  });

  assert.equal(context.goals.length, 20);
  assert.equal(context.availableTimeMinutes, 1440);
  assert.equal(context.consistency.outcomeCount, 20);
  assert.equal(context.consistency.missedQuests.length, 10);
  assert.equal(buildPlayerContext({ availableTimeMinutes: -5 }).availableTimeMinutes, null);
});

test("malformed context input safely produces an empty context", () => {
  const context = buildPlayerContext(null);
  assert.deepEqual(context.goals, []);
  assert.deepEqual(context.skills.assessed, []);
  assert.equal(context.consistency.completionRate, null);
  assert.equal(context.availableTimeMinutes, null);
});

test("new players receive neutral, evidence-free personalization", () => {
  const context = buildPlayerContext({ goals: ["Build an API"], currentQuests: [{ title: "Active quest" }] });
  assert.equal(context.consistency.outcomeCount, 0);
  assert.equal(context.consistency.difficultyGuidance, "hold");
  assert.equal(context.performance.allowedDifficulties, null);
  assert.deepEqual(context.performance.consistentlyPracticedSkills, []);
  assert.equal(context.performance.goalCoverage[0].signal, "no_recent_recorded_match");
});

test("history completion evidence remains neutral until at least five outcomes", () => {
  const context = buildPlayerContext({ history: Array.from({ length: 4 }, (_, index) => ({
    title: `Completed task ${index}`, category: "Backend", difficulty: "EASY",
  })) });
  assert.equal(context.consistency.outcomeCount, 4);
  assert.equal(context.consistency.difficultyGuidance, "hold");
  assert.equal(context.performance.allowedDifficulties, null);
  assert.equal(context.performance.skillPractice.find(({ skill }) => skill === "Backend").pattern,
    "consistent_recent_practice");
});

test("repeated successes permit only a one-step difficulty increase", () => {
  const context = buildPlayerContext({ activityLog: Array.from({ length: 5 }, (_, index) =>
    activity("completed", index, "MEDIUM")) });
  assert.equal(context.consistency.difficultyGuidance, "slight_increase");
  assert.deepEqual(context.performance.allowedDifficulties, ["MEDIUM", "HARD"]);
});

test("repeated explicitly recorded misses permit only a one-step decrease", () => {
  const context = buildPlayerContext({ activityLog: Array.from({ length: 5 }, (_, index) =>
    activity("missed", index, "HARD")) });
  assert.equal(context.consistency.missedCount, 5);
  assert.equal(context.consistency.difficultyGuidance, "slight_decrease");
  assert.deepEqual(context.performance.allowedDifficulties, ["MEDIUM", "HARD"]);
});

test("explicit abandoned outcomes contribute to the evidence-based non-completion trend", () => {
  const context = buildPlayerContext({ activityLog: Array.from({ length: 5 }, (_, index) => ({
    title: `Abandoned ${index}`, status: "abandoned", category: "Backend", difficulty: "HARD",
  })) });
  assert.equal(context.consistency.abandonedCount, 5);
  assert.equal(context.consistency.completionRate, 0);
  assert.equal(context.consistency.difficultyGuidance, "slight_decrease");
  assert.deepEqual(context.performance.allowedDifficulties, ["MEDIUM", "HARD"]);
});

test("unfinished quests are active context only and never become missed outcomes", () => {
  const context = buildPlayerContext({ currentQuests: [
    { title: "Still available", completed: false },
    { title: "Already complete", completed: true },
  ] });
  assert.deepEqual(context.activeQuestTitles, ["Still available"]);
  assert.equal(context.consistency.outcomeCount, 0);
  assert.equal(context.consistency.missedCount, 0);
  assert.deepEqual(context.consistency.missedQuests, []);
});

test("context counts only explicit completed, missed, and abandoned records; pending is ignored", () => {
  const context = buildPlayerContext({
    activityLog: [
      { title: "Completed", status: "completed", category: "Backend", difficulty: "MEDIUM", recordedAt: "2026-10-19T10:00:00.000Z" },
      { title: "Missed", status: "missed", category: "Backend", difficulty: "MEDIUM" },
      { title: "Abandoned", status: "abandoned", category: "Backend", difficulty: "EASY" },
      { title: "Still pending", status: "pending", category: "Backend", difficulty: "HARD" },
    ],
    currentQuests: [{ title: "Still pending", completed: false }],
  });
  assert.equal(context.consistency.completedCount, 1);
  assert.equal(context.consistency.missedCount, 1);
  assert.equal(context.consistency.abandonedCount, 1);
  assert.equal(context.consistency.outcomeCount, 3);
  assert.equal(context.consistency.difficultyGuidance, "hold");
  assert.equal(context.consistency.missedQuests.some(({ title }) => title === "Still pending"), false);
});

test("completion history and its activity record count as one outcome", () => {
  const context = buildPlayerContext({
    history: [{
      title: "Completed route", category: "Backend", difficulty: "MEDIUM",
      completedAt: "2026-10-19T10:00:00.000Z",
    }],
    activityLog: [{
      title: "Completed route", status: "completed", category: "Backend", difficulty: "MEDIUM",
      recordedAt: "2026-10-19T10:00:00.000Z",
    }],
  });
  assert.equal(context.consistency.completedCount, 1);
  assert.equal(context.consistency.outcomeCount, 1);
});

test("unassessed skills remain unknown and recorded goal matches identify limited coverage", () => {
  const context = buildPlayerContext({
    goals: ["Practice backend APIs", "Improve fitness"],
    assessedSkills: ["Coding"],
    skills: { Coding: 20 },
    progression: { skillPracticeXp: { Coding: 50, Backend: 100, Unknown: 900 } },
    history: [
      { title: "Build a backend API", category: "Backend", difficulty: "EASY" },
      { title: "Build a backend API test", category: "Backend", difficulty: "EASY" },
    ],
  });
  assert.equal(context.performance.skillPractice.find(({ skill }) => skill === "Backend").assessedScore, null);
  assert.equal(context.skills.unassessed.includes("Backend"), true);
  assert.equal(context.performance.goalCoverage[0].signal, "recently_supported");
  assert.equal(context.performance.goalCoverage[1].signal, "no_recent_recorded_match");
  assert.deepEqual(context.progression.skillPracticeXp, { Coding: 50, Backend: 100 });
});
