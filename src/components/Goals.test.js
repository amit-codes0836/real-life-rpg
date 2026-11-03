import assert from "node:assert/strict";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { createServer } from "vite";

let vite;
let addGoalToList;

before(async () => {
  vite = await createServer({
    configFile: resolve(process.cwd(), "vite.config.js"),
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  ({ addGoalToList } = await vite.ssrLoadModule("/src/components/Goals.jsx"));
});

after(async () => {
  await vite?.close();
});

test("goal creation trims new text and preserves existing saved goals", () => {
  const existingGoals = ["  Keep this existing goal  ", "Another goal"];
  const result = addGoalToList(existingGoals, "  Write a small API  ");

  assert.equal(result.added, true);
  assert.deepEqual(result.goals, [...existingGoals, "Write a small API"]);
  assert.deepEqual(existingGoals, ["  Keep this existing goal  ", "Another goal"]);
});

test("duplicate goals are rejected despite case or surrounding whitespace differences", () => {
  const existingGoals = ["Build a small API"];

  for (const draft of ["build a small api", "  BUILD A SMALL API  ", "Build a small API "]) {
    const result = addGoalToList(existingGoals, draft);
    assert.equal(result.added, false);
    assert.equal(result.error, "That goal is already on your list. Try a different goal.");
    assert.equal(result.goals, existingGoals);
    assert.deepEqual(result.goals, ["Build a small API"]);
  }
});

test("empty goal drafts do not update the saved list", () => {
  const existingGoals = ["Existing goal"];
  const result = addGoalToList(existingGoals, "   ");

  assert.equal(result.added, false);
  assert.equal(result.error, "");
  assert.equal(result.goals, existingGoals);
});
