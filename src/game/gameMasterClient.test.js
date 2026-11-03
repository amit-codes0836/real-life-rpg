import test from "node:test";
import assert from "node:assert/strict";
import { requestGameMasterQuests } from "./gameMasterClient.js";
import { createInitialProgression, recordQuestCompletion } from "./progression.js";
import { loadWeeklyBossState } from "./bossBattles.js";
import { validateQuestCandidates } from "../../backend/gameMaster.js";

const validQuests = [
  { title: "Practice API validation", category: "Backend", difficulty: "MEDIUM", reason: "Practice one request path." },
  { title: "Review an ML concept", category: "AI / ML", difficulty: "EASY", reason: "Strengthen one assessed topic." },
  { title: "Take a short walk", category: "Fitness", difficulty: "HARD", reason: "Build a practical movement habit." },
];

test("client derives reward fields locally and marks suggestions incomplete", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ quests: validQuests.map((quest) => ({ ...quest, xp: 9999, id: "unsafe", completed: true })) }) });
  try {
    const quests = await requestGameMasterQuests({}, 7);
    assert.equal(quests.length, 3);
    assert.deepEqual(quests.map((quest) => quest.xp), [45, 25, 70]);
    assert.ok(quests.every((quest) => quest.completed === false && quest.id.startsWith("ai-7-")));
    assert.equal(new Set(quests.map((quest) => quest.id)).size, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("client rejects malformed model/API output before replacing quests", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ quests: [{ ...validQuests[0], category: "Unknown" }, ...validQuests.slice(1)] }) });
  try {
    await assert.rejects(requestGameMasterQuests({}, 8), /invalid quest set/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("client surfaces quota errors without requesting another model", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 429, json: async () => ({ error: "GEMINI_QUOTA_EXCEEDED" }) });
  try {
    await assert.rejects(requestGameMasterQuests({}, 9), /free-tier quota/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("client sends explicit activity outcomes through the existing context request", async () => {
  const originalFetch = globalThis.fetch;
  let body;
  globalThis.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ quests: validQuests }) };
  };
  try {
    await requestGameMasterQuests({
      activityLog: [
        { title: "Done", status: "completed", category: "Backend", difficulty: "EASY", recordedAt: "2026-10-19T10:00:00.000Z" },
        { title: "Missed", status: "missed", category: "Backend", difficulty: "EASY" },
        { title: "Stopped", status: "abandoned", category: "Backend", difficulty: "MEDIUM" },
      ],
    }, 16);
    assert.deepEqual(body.activityLog.map(({ status }) => status), ["completed", "missed", "abandoned"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("client preserves validated extended quest fields and makes IDs unique across generations", async () => {
  const originalFetch = globalThis.fetch;
  const detailed = validQuests.map((quest, index) => ({
    ...quest,
    estimatedDurationMinutes: 5 + index,
    objective: `Complete objective ${index + 1}.`,
    instructions: ["Choose one focused action.", "Complete and record the result."],
    successCriteria: [`Create ${index + 1} saved result.`],
    skillImpact: {
      skill: quest.category,
      impact: "practice",
      explanation: "Practice this skill with a focused activity.",
    },
    suggestedRewards: { xp: 999999, milestone: "Mark a completed practice." },
    optionalLongerChallenge: false,
  }));
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ quests: detailed }) });
  try {
    const first = await requestGameMasterQuests({}, 10);
    const second = await requestGameMasterQuests({}, 11);
    assert.equal(first[0].estimatedDurationMinutes, 5);
    assert.equal(first[0].objective, "Complete objective 1.");
    assert.deepEqual(first[0].successCriteria, ["Create 1 saved result."]);
    assert.equal(first[0].skillImpact.skill, "Backend");
    assert.equal(first[0].suggestedRewards.xp, 45);
    assert.equal(first[0].optionalLongerChallenge, false);
    assert.equal(new Set([...first, ...second].map((quest) => quest.id)).size, 6);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("client rejects titles that repeat an active quest", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ quests: validQuests }) });
  try {
    await assert.rejects(requestGameMasterQuests({
      currentQuests: [{ title: validQuests[0].title, completed: false }],
    }, 15), /invalid quest set/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("network failures, malformed responses, and timeouts become safe client errors", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error("secret-key-should-not-escape"); };
    await assert.rejects(requestGameMasterQuests({}, 12), (error) => {
      assert.match(error.message, /backend is not reachable/i);
      assert.doesNotMatch(error.message, /secret-key/i);
      return true;
    });

    globalThis.fetch = async () => ({ ok: true, json: async () => { throw new SyntaxError("bad body"); } });
    await assert.rejects(requestGameMasterQuests({}, 13), /unreadable response/i);

    globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
    await assert.rejects(requestGameMasterQuests({}, 14, { timeoutMs: 5 }), /timed out/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("validated AI quests work through XP, history, boss rewards, and idempotent completion", async () => {
  const originalFetch = globalThis.fetch;
  const questTitles = [
    "Build a REST route", "Debug a cache race", "Document the auth flow",
    "Refactor the parser module", "Profile query speed", "Secure a webhook route",
  ];
  const allQuests = questTitles.map((title, index) => ({
    title,
    category: "Backend",
    difficulty: "HARD",
    estimatedDurationMinutes: 5,
    objective: `Complete one backend exercise ${index + 1}.`,
    instructions: ["Choose one small API task.", "Complete it and record the result."],
    successCriteria: [`Complete ${index + 1} API checks and record the result.`],
    skillImpact: {
      skill: "Backend",
      impact: "practice",
      explanation: "Practices one backend workflow.",
    },
    suggestedRewards: { xp: 999, milestone: "Record one completed practice." },
    optionalLongerChallenge: false,
    reason: "Practice one focused backend skill.",
  }));
  let requestIndex = 0;
  globalThis.fetch = async () => {
    const responseQuests = allQuests.slice(requestIndex * 3, requestIndex * 3 + 3);
    requestIndex += 1;
    return {
      ok: true,
      json: async () => ({ quests: validateQuestCandidates(responseQuests, { availableTimeMinutes: 20 }) }),
    };
  };

  try {
    const date = new Date(2026, 9, 19, 12);
    let progression = createInitialProgression(loadWeeklyBossState(null, date));
    const firstBatch = await requestGameMasterQuests({}, 20);
    const secondBatch = await requestGameMasterQuests({}, 21);
    assert.equal(new Set([...firstBatch, ...secondBatch].map((quest) => quest.id)).size, 6);

    for (const quest of [...firstBatch, ...secondBatch]) {
      progression = recordQuestCompletion(progression, quest, date.toISOString());
    }
    const duplicate = recordQuestCompletion(progression, firstBatch[0], date.toISOString());

    assert.equal(progression.history.length, 6);
    assert.equal(progression.totalXpEarned, 620);
    assert.equal(progression.skillPracticeXp.Backend, 420);
    assert.equal(progression.weeklyBoss.defeated, true);
    assert.equal(progression.history[0].bossBonusXpEarned, 200);
    assert.equal(duplicate, progression);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
