import { defaultSkills } from "../data/skills.js";

export const GAME_MASTER_REQUEST_TIMEOUT_MS = 20_000;

const XP_BY_DIFFICULTY = { EASY: 25, MEDIUM: 45, HARD: 70 };
const DEFAULT_AVAILABLE_TIME_MINUTES = 30;

function createQuestId(generation, index) {
  const suffix = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `ai-${generation}-${index}-${suffix}`;
}

const cleanText = (value, maxLength) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const normalizeTitle = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function hasMeasurableSuccessCriteria(criteria) {
  return criteria.some((criterion) => /\b\d+\b/.test(criterion)
    || /\b(created|written|saved|completed|solved|returned|sent|delivered|recorded|tested|committed|published|shared|explained)\b/i.test(criterion));
}

function invalidQuestSet() {
  return new Error("The Game Master returned an invalid quest set. Your current quests were kept.");
}

function validateQuestResponse(value, generation, context = {}) {
  if (!value || !Array.isArray(value.quests) || value.quests.length < 3 || value.quests.length > 5) {
    throw invalidQuestSet();
  }

  const timeBudget = Number.isFinite(context.availableTimeMinutes)
    ? context.availableTimeMinutes
    : DEFAULT_AVAILABLE_TIME_MINUTES;
  const titles = new Set();
  const activeTitles = new Set((context.currentQuests || [])
    .filter((quest) => quest && !quest.completed && typeof quest.title === "string")
    .map((quest) => normalizeTitle(quest.title)));
  const normalizedQuests = value.quests.map((quest, index) => {
    if (!quest || typeof quest !== "object" || Array.isArray(quest)) throw invalidQuestSet();
    const title = cleanText(quest.title, 100);
    const category = cleanText(quest.category, 40);
    const difficulty = typeof quest.difficulty === "string" ? quest.difficulty.toUpperCase() : "";
    const reason = cleanText(quest.reason, 180);
    const normalizedTitle = normalizeTitle(title);
    if (
      title.length < 4
      || (!defaultSkills.includes(category) && category !== "Personal Goal")
      || !Object.hasOwn(XP_BY_DIFFICULTY, difficulty)
      || reason.length < 8
      || titles.has(normalizedTitle)
      || activeTitles.has(normalizedTitle)
    ) {
      throw invalidQuestSet();
    }
    titles.add(normalizedTitle);

    const mapped = {
      id: createQuestId(generation, index),
      title,
      category,
      skill: defaultSkills.includes(category) ? category : null,
      difficulty,
      xp: XP_BY_DIFFICULTY[difficulty],
      completed: false,
      reason,
    };

    // Keep detailed fields when returned by the current backend; allow the older
    // response shape so frontend deployments can roll forward independently.
    if (quest.estimatedDurationMinutes !== undefined) {
      if (!Number.isInteger(quest.estimatedDurationMinutes)
        || quest.estimatedDurationMinutes < 3 || quest.estimatedDurationMinutes > 180) {
        throw invalidQuestSet();
      }
      mapped.estimatedDurationMinutes = quest.estimatedDurationMinutes;
    }
    if (quest.objective !== undefined) {
      mapped.objective = cleanText(quest.objective, 300);
      if (mapped.objective.length < 12) throw invalidQuestSet();
    }
    if (quest.instructions !== undefined) {
      if (!Array.isArray(quest.instructions) || quest.instructions.length < 2 || quest.instructions.length > 5) {
        throw invalidQuestSet();
      }
      mapped.instructions = quest.instructions.map((item) => cleanText(item, 240));
      if (mapped.instructions.some((item) => item.length < 8)) throw invalidQuestSet();
    }
    if (quest.successCriteria !== undefined) {
      if (!Array.isArray(quest.successCriteria) || quest.successCriteria.length < 1 || quest.successCriteria.length > 3) {
        throw invalidQuestSet();
      }
      mapped.successCriteria = quest.successCriteria.map((item) => cleanText(item, 180));
      if (mapped.successCriteria.some((item) => item.length < 8)
        || !hasMeasurableSuccessCriteria(mapped.successCriteria)) throw invalidQuestSet();
    }
    if (quest.skillImpact !== undefined) {
      const impact = quest.skillImpact;
      if (!impact || !defaultSkills.includes(impact.skill)
        || !["practice", "develop", "apply"].includes(impact.impact)
        || cleanText(impact.explanation, 160).length < 8
        || (defaultSkills.includes(category) && impact.skill !== category)) throw invalidQuestSet();
      mapped.skillImpact = {
        skill: impact.skill,
        impact: impact.impact,
        explanation: cleanText(impact.explanation, 160),
      };
    }
    if (quest.suggestedRewards !== undefined) {
      if (!quest.suggestedRewards || typeof quest.suggestedRewards !== "object"
        || typeof quest.suggestedRewards.milestone !== "string") throw invalidQuestSet();
      mapped.suggestedRewards = {
        xp: XP_BY_DIFFICULTY[difficulty],
        milestone: cleanText(quest.suggestedRewards.milestone, 100),
      };
      if (mapped.suggestedRewards.milestone.length < 4) throw invalidQuestSet();
    }
    if (quest.optionalLongerChallenge !== undefined) {
      if (typeof quest.optionalLongerChallenge !== "boolean") throw invalidQuestSet();
      mapped.optionalLongerChallenge = quest.optionalLongerChallenge;
    }
    return mapped;
  });

  const mandatoryDuration = normalizedQuests.reduce((total, quest) => {
    if (quest.estimatedDurationMinutes === undefined || quest.optionalLongerChallenge) return total;
    return total + quest.estimatedDurationMinutes;
  }, 0);
  if (mandatoryDuration > timeBudget) throw invalidQuestSet();

  const ids = new Set(normalizedQuests.map((quest) => quest.id));
  if (ids.size !== normalizedQuests.length) throw invalidQuestSet();
  return normalizedQuests;
}

function messageForApiError(code, status) {
  if (code === "GEMINI_NOT_CONFIGURED") return "Game Master is not configured yet. Add GEMINI_API_KEY to backend/.env, then restart the backend.";
  if (code === "GEMINI_QUOTA_EXCEEDED") return "Gemini's free-tier quota is currently unavailable. Check your AI Studio project quota; no paid model was selected.";
  if (code === "RATE_LIMITED" || status === 429) return "Too many requests. Wait a minute before asking the Game Master again.";
  if (status === 400 || status === 413) return "The Game Master request was invalid or too large. Your current quests were kept.";
  return "The Game Master could not generate quests. Check that the backend is running and try again; your current quests were kept.";
}

export async function requestGameMasterQuests(context, generation, {
  fetchImpl = globalThis.fetch,
  timeoutMs = GAME_MASTER_REQUEST_TIMEOUT_MS,
} = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let response;
    try {
      response = await fetchImpl("/api/game-master/quests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
        signal: controller.signal,
      });
    } catch {
      if (timedOut) throw new Error("The Game Master request timed out. Your current quests were kept.");
      throw new Error("The Game Master backend is not reachable. Start it with npm run dev in backend/.");
    }

    let body;
    try {
      body = await response.json();
    } catch {
      if (timedOut) throw new Error("The Game Master request timed out. Your current quests were kept.");
      throw new Error("The Game Master returned an unreadable response. Your current quests were kept.");
    }
    if (timedOut) throw new Error("The Game Master request timed out. Your current quests were kept.");
    if (!response.ok) throw new Error(messageForApiError(body?.error, response.status));
    return validateQuestResponse(body, generation, context);
  } finally {
    clearTimeout(timeoutId);
  }
}
