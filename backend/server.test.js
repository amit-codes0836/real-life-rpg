import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "./server.js";
import { GameMasterError, validateGameMasterInput } from "./gameMaster.js";

async function withServer(app, callback) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

const postQuests = (baseUrl, body = {}, headers = {}) => fetch(`${baseUrl}/api/game-master/quests`, {
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});

test("GET /api/health returns the safe health response", async () => {
  await withServer(createApp(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });
});

test("POST /api/game-master/quests returns successful mocked generation", async () => {
  const expectedQuests = [{ id: "mock-quest", title: "Mocked quest", xp: 25 }];
  let receivedInput;
  const app = createApp({
    generateQuests: async (input) => {
      receivedInput = input;
      return expectedQuests;
    },
  });

  await withServer(app, async (baseUrl) => {
    const input = { character: { name: "Synthetic" }, goals: ["Practice safely"] };
    const response = await postQuests(baseUrl, input);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { quests: expectedQuests });
    assert.deepEqual(receivedInput, input);
  });
});

test("invalid request input returns a safe 400 response", async () => {
  const app = createApp({
    generateQuests: (input) => {
      validateGameMasterInput(input);
      return [];
    },
  });
  await withServer(app, async (baseUrl) => {
    const response = await postQuests(baseUrl, []);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "INVALID_REQUEST" });
  });
});

test("invalid model output maps to a safe public response", async () => {
  const app = createApp({
    generateQuests: async () => {
      throw new GameMasterError("INVALID_MODEL_OUTPUT", 502, { validationCode: "INVALID_QUEST_FIELD" });
    },
  });
  await withServer(app, async (baseUrl) => {
    const response = await postQuests(baseUrl);
    const body = await response.text();
    assert.equal(response.status, 502);
    assert.deepEqual(JSON.parse(body), { error: "INVALID_MODEL_OUTPUT" });
    assert.doesNotMatch(body, /INVALID_QUEST_FIELD|prompt|title|instructions|api.?key/i);
  });
});

test("provider timeout maps to a safe gateway timeout response", async () => {
  const app = createApp({
    generateQuests: async () => { throw new GameMasterError("GEMINI_TIMEOUT", 504); },
  });
  await withServer(app, async (baseUrl) => {
    const response = await postQuests(baseUrl);
    assert.equal(response.status, 504);
    assert.deepEqual(await response.json(), { error: "GEMINI_TIMEOUT" });
  });
});

test("missing API configuration maps to a safe service-unavailable response", async () => {
  const app = createApp({
    generateQuests: async () => { throw new GameMasterError("GEMINI_NOT_CONFIGURED", 503); },
  });
  await withServer(app, async (baseUrl) => {
    const response = await postQuests(baseUrl);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "GEMINI_NOT_CONFIGURED" });
  });
});

test("provider exceptions never expose secrets or internal details", async () => {
  const app = createApp({
    generateQuests: async () => { throw new Error("SECRET_KEY full prompt and provider response body"); },
  });
  await withServer(app, async (baseUrl) => {
    const response = await postQuests(baseUrl);
    const body = await response.text();
    assert.equal(response.status, 500);
    assert.deepEqual(JSON.parse(body), { error: "GAME_MASTER_UNAVAILABLE" });
    assert.doesNotMatch(body, /SECRET_KEY|full prompt|provider response body/);
  });
});

test("rate limiting blocks requests after the configured request count", async () => {
  let generationCount = 0;
  const app = createApp({
    rateMaxRequests: 2,
    rateWindowMs: 60_000,
    generateQuests: async () => {
      generationCount += 1;
      return [];
    },
  });
  await withServer(app, async (baseUrl) => {
    assert.equal((await postQuests(baseUrl)).status, 200);
    assert.equal((await postQuests(baseUrl)).status, 200);
    const blocked = await postQuests(baseUrl);
    assert.equal(blocked.status, 429);
    assert.deepEqual(await blocked.json(), { error: "RATE_LIMITED" });
    assert.equal(generationCount, 2);
  });
});

test("CORS allows configured origins and rejects other origins", async () => {
  await withServer(createApp(), async (baseUrl) => {
    const allowed = await fetch(`${baseUrl}/api/game-master/quests`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:5173");
    assert.match(allowed.headers.get("access-control-allow-methods"), /POST/);
    assert.match(allowed.headers.get("access-control-allow-headers"), /Content-Type/i);

    const rejected = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: "https://untrusted.example" },
    });
    assert.equal(rejected.status, 403);
    assert.deepEqual(await rejected.json(), { error: "ORIGIN_NOT_ALLOWED" });
  });
});
