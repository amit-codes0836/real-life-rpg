import test from "node:test";
import assert from "node:assert/strict";
import {
  buildActivitySummary,
  calculateCurrentStreak,
  localDateKey,
  normalizeActualDuration,
  validLocalDateKey,
} from "./activityTracking.js";

const localDate = (year, month, day) => localDateKey(new Date(year, month - 1, day, 12));

test("local date keys use the player's calendar date and reject invalid dates", () => {
  assert.equal(localDate(2026, 3, 8), "2026-03-08");
  assert.equal(validLocalDateKey("2026-03-08"), true);
  assert.equal(validLocalDateKey("2026-02-30"), false);
});

test("stored local calendar date wins over a UTC timestamp near midnight", () => {
  const summary = buildActivitySummary({
    progression: {
      activityRecords: [{
        questId: "midnight", status: "completed", localDate: "2026-10-19",
        recordedAt: "2026-10-20T00:15:00.000Z",
      }],
      history: [],
    },
    now: new Date(2026, 9, 19, 23, 55),
  });
  assert.equal(summary.today.completed, 1);
  assert.equal(summary.week.activeDays, 1);
});

test("actual duration is optional and accepts only whole minutes from 1 to 1440", () => {
  assert.equal(normalizeActualDuration(undefined), null);
  assert.equal(normalizeActualDuration(""), null);
  assert.equal(normalizeActualDuration("25"), 25);
  for (const invalid of [-1, 0, 1441, 2.5, "not time"]) {
    assert.equal(normalizeActualDuration(invalid), null);
  }
});

test("streak counts consecutive local completed days once and breaks after a gap", () => {
  const records = [
    { status: "completed", localDate: "2026-03-06" },
    { status: "completed", localDate: "2026-03-07" },
    { status: "completed", localDate: "2026-03-07" },
    { status: "missed", localDate: "2026-03-08" },
  ];
  assert.equal(calculateCurrentStreak(records, new Date(2026, 2, 8, 12)), 2);
  assert.equal(calculateCurrentStreak(records, new Date(2026, 2, 10, 12)), 0);
  const withGap = [
    ...records,
    { status: "completed", localDate: "2026-03-09" },
  ];
  assert.equal(calculateCurrentStreak(withGap, new Date(2026, 2, 10, 12)), 1);
  assert.equal(calculateCurrentStreak(withGap, new Date(2026, 2, 11, 12)), 0);
});

test("daily and weekly summaries count explicit outcomes, leave pending separate, and use a clear rate denominator", () => {
  const today = "2026-10-19";
  const records = [
    { questId: "done", status: "completed", localDate: today, actualDurationMinutes: 12 },
    { questId: "miss", status: "missed", localDate: today },
    { questId: "abandon", status: "abandoned", localDate: today, actualDurationMinutes: 7 },
    { questId: "old", status: "completed", localDate: "2026-10-18" },
  ];
  const history = [
    { id: "done", category: "Backend", xpEarned: 45, bossBonusXpEarned: 10, localDate: today },
    { id: "old", category: "Coding", xpEarned: 25, bossBonusXpEarned: 0, localDate: "2026-10-18" },
  ];
  const summary = buildActivitySummary({
    quests: [
      { id: "done", completed: true },
      { id: "miss", outcomeStatus: "missed" },
      { id: "pending" },
    ],
    progression: { activityRecords: records, history },
    now: new Date(2026, 9, 19, 12),
  });

  assert.deepEqual(summary.today, {
    completed: 1, missed: 1, abandoned: 1, pending: 1,
    xpEarned: 55, actualMinutes: 19, timedOutcomeCount: 2,
  });
  assert.equal(summary.week.completed, 2);
  assert.equal(summary.week.missed, 1);
  assert.equal(summary.week.abandoned, 1);
  assert.equal(summary.week.outcomeCount, 4);
  assert.equal(summary.week.completionRate, 0.5);
  assert.equal(summary.week.xpEarned, 80);
  assert.deepEqual(summary.week.skillPracticeXp, { Backend: 45, Coding: 25 });
  assert.equal(summary.week.activeDays, 2);
  assert.equal(summary.week.currentStreak, 2);
});
