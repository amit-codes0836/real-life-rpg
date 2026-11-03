import assert from "node:assert/strict";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { loadWeeklyBossState } from "../game/bossBattles.js";

let vite;
let WeeklyBoss;

before(async () => {
  vite = await createServer({ configFile: resolve(process.cwd(), "vite.config.js"), server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  ({ default: WeeklyBoss } = await vite.ssrLoadModule("/src/components/WeeklyBoss.jsx"));
});

after(async () => { await vite?.close(); });

test("boss presentation shows actual remaining health, progress, and current quest damage", () => {
  const date = new Date(2026, 10, 3, 12);
  const boss = { ...loadWeeklyBossState(null, date), currentHp: 90 };
  const html = renderToStaticMarkup(React.createElement(WeeklyBoss, { boss, damageFeedback: 20 }));
  const defeatedPercent = Math.round(((boss.targetHp - boss.currentHp) / boss.targetHp) * 100);
  assert.match(html, /90 HP REMAINING/);
  assert.match(html, new RegExp(`${defeatedPercent}% defeated`));
  assert.match(html, /aria-valuenow="90"/);
  assert.match(html, new RegExp(`aria-valuemax="${boss.targetHp}"`));
  assert.match(html, new RegExp(`90 of ${boss.targetHp} HP remaining`));
  assert.match(html, /−20 HP this quest/);
});
