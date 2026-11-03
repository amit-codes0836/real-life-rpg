import assert from "node:assert/strict";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let vite;
let GameplayFeedback;

before(async () => {
  vite = await createServer({ configFile: resolve(process.cwd(), "vite.config.js"), server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  ({ default: GameplayFeedback } = await vite.ssrLoadModule("/src/components/GameplayFeedback.jsx"));
});

after(async () => { await vite?.close(); });

test("XP feedback displays actual earned XP, practice progress, boss damage, and real level-up only", () => {
  const html = renderToStaticMarkup(React.createElement(GameplayFeedback, { feedback: {
    xpEarned: 225,
    questXp: 25,
    bossBonusXp: 200,
    skill: "Backend",
    skillPracticeXp: 25,
    skillPracticeTotal: 75,
    bossDamage: 20,
    levelUp: true,
    level: 2,
  } }));
  assert.match(html, /\+225 XP earned/);
  assert.match(html, /Includes \+200 weekly boss bonus/);
  assert.match(html, /Backend: \+25 practice XP · 75 total/);
  assert.match(html, /Weekly boss took 20 damage/);
  assert.match(html, /LEVEL UP · LEVEL 2/);
  assert.match(html, /aria-live="polite"/);
});

test("no feedback is shown without a completed progression result", () => {
  assert.equal(renderToStaticMarkup(React.createElement(GameplayFeedback, { feedback: null })), "");
});
