import assert from "node:assert/strict";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let vite;
let ActivitySummary;

before(async () => {
  vite = await createServer({ configFile: resolve(process.cwd(), "vite.config.js"), server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  ({ default: ActivitySummary } = await vite.ssrLoadModule("/src/components/ActivitySummary.jsx"));
});

after(async () => { await vite?.close(); });

test("streak and active days are rendered from calculated activity data", () => {
  const html = renderToStaticMarkup(React.createElement(ActivitySummary, {
    activity: {
      today: { completed: 1, missed: 0, abandoned: 0, pending: 2, xpEarned: 25, actualMinutes: 10, timedOutcomeCount: 1 },
      week: { completed: 3, missed: 1, abandoned: 0, outcomeCount: 4, completionRate: 0.75, xpEarned: 95, skillPracticeXp: { Backend: 75 }, activeDays: 3, currentStreak: 2 },
    },
    defaultSkills: ["Backend", "Coding"],
  }));
  assert.match(html, /Current streak/);
  assert.match(html, /2 days/);
  assert.match(html, /Active days/);
  assert.match(html, /3 \/ 7/);
  assert.match(html, /75 XP/);
  assert.match(html, /Pending quests are excluded/);
});
