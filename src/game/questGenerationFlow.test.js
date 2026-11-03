import test from "node:test";
import assert from "node:assert/strict";
import { generateQuestSetWithFallback } from "./questGenerationFlow.js";

const board = [{ id: "old-quest", title: "Existing board quest" }];
const localQuests = [{ id: "local-quest", title: "Local fallback quest" }];

for (const [label, error] of [
  ["backend unavailable", new Error("backend unavailable")],
  ["quota exceeded", new Error("quota exceeded")],
  ["malformed response", new Error("malformed response")],
  ["request timed out", new Error("request timed out")],
]) {
  test(`uses local quests when AI generation fails: ${label}`, async () => {
    let localCalls = 0;
    const result = await generateQuestSetWithFallback({
      requestAI: async () => { throw error; },
      generateLocal: () => { localCalls += 1; return localQuests; },
      currentQuests: board,
    });

    assert.equal(result.source, "local");
    assert.equal(result.quests, localQuests);
    assert.equal(localCalls, 1);
    assert.match(result.error, /local quests are shown/i);
  });
}

test("uses AI quests without invoking local generation", async () => {
  const aiQuests = [{ id: "ai-quest", title: "AI quest" }];
  const result = await generateQuestSetWithFallback({
    requestAI: async () => aiQuests,
    generateLocal: () => { throw new Error("must not run"); },
    currentQuests: board,
  });

  assert.equal(result.source, "ai");
  assert.equal(result.quests, aiQuests);
  assert.equal(result.error, "");
});

test("preserves the existing quest board if local generation throws or returns empty", async () => {
  for (const generateLocal of [
    () => { throw new Error("local failure"); },
    () => [],
    () => null,
  ]) {
    const result = await generateQuestSetWithFallback({
      requestAI: async () => { throw new Error("AI unavailable"); },
      generateLocal,
      currentQuests: board,
    });
    assert.equal(result.source, "existing");
    assert.equal(result.quests, board);
    assert.match(result.error, /existing quests were kept/i);
  }
});

test("does not replace the board with an empty AI response", async () => {
  const result = await generateQuestSetWithFallback({
    requestAI: async () => [],
    generateLocal: () => localQuests,
    currentQuests: board,
  });
  assert.equal(result.source, "local");
  assert.equal(result.quests, localQuests);
});
