import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import {
  GameMasterError,
  generatePersonalizedQuests,
} from "./gameMaster.js";

const backendDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(backendDir, ".env") });

const PORT = Number(process.env.PORT) || 3001;
const FRONTEND_ORIGINS = new Set([
  process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 8;

export function createApp({
  generateQuests = generatePersonalizedQuests,
  allowedOrigins = FRONTEND_ORIGINS,
  rateWindowMs = RATE_WINDOW_MS,
  rateMaxRequests = RATE_MAX_REQUESTS,
} = {}) {
  const requestCounts = new Map();
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (origin && !allowedOrigins.has(origin)) {
      return res.status(403).json({ error: "ORIGIN_NOT_ALLOWED" });
    }
    if (origin) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: "24kb", strict: true }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/game-master/quests", async (req, res) => {
    const now = Date.now();
    const clientId = req.ip || "local";
    const current = requestCounts.get(clientId);
    if (!current || now - current.startedAt >= rateWindowMs) {
      requestCounts.set(clientId, { startedAt: now, count: 0 });
    }
    const bucket = requestCounts.get(clientId);
    bucket.count += 1;
    if (bucket.count > rateMaxRequests) {
      return res.status(429).json({ error: "RATE_LIMITED" });
    }

    try {
      const quests = await generateQuests(req.body);
      return res.json({ quests });
    } catch (error) {
      if (error instanceof GameMasterError) {
        if (error.validationCode) {
          console.warn(`Game Master validation rejected output: ${error.validationCode}`);
        }
        return res.status(error.status).json({ error: error.code });
      }
      if (error instanceof SyntaxError && error.type === "entity.parse.failed") {
        return res.status(400).json({ error: "INVALID_JSON" });
      }
      if (error?.type === "entity.too.large") {
        return res.status(413).json({ error: "REQUEST_TOO_LARGE" });
      }
      return res.status(500).json({ error: "GAME_MASTER_UNAVAILABLE" });
    }
  });

  app.use((error, _req, res, _next) => {
    if (error?.type === "entity.too.large") return res.status(413).json({ error: "REQUEST_TOO_LARGE" });
    if (error instanceof SyntaxError && error.type === "entity.parse.failed") return res.status(400).json({ error: "INVALID_JSON" });
    return res.status(500).json({ error: "SERVER_ERROR" });
  });

  return app;
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  const server = createApp().listen(PORT, "127.0.0.1", () => {
    // Deliberately log only non-sensitive startup information.
    console.info(`Game Master backend listening on http://127.0.0.1:${PORT}`);
  });

  const stop = () => server.close(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
