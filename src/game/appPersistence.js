import { defaultSkills } from "../data/skills.js";
import { generateDailyQuests } from "./questGenerator.js";
import { localDateKey, normalizeActualDuration, validLocalDateKey } from "./activityTracking.js";
import {
  getWeeklyBossForDate,
  loadWeeklyBossState,
  persistWeeklyBossState,
} from "./bossBattles.js";

export const GAME_STATE_STORAGE_KEY = "real-life-rpg.game-state.v1";

function getBrowserStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const finiteNonNegative = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};

const finiteScore = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
};

function sanitizeStringList(value, maxLength = 200) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim().slice(0, maxLength))
    .filter(Boolean))];
}

function sanitizeQuests(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap((quest) => {
    if (!quest || typeof quest !== "object" || typeof quest.id !== "string" || !quest.id || seen.has(quest.id)) {
      return [];
    }
    const id = quest.id.slice(0, 200);
    if (seen.has(id)) return [];
    seen.add(id);
    const difficulty = ["EASY", "MEDIUM", "HARD"].includes(String(quest.difficulty).toUpperCase())
      ? String(quest.difficulty).toUpperCase()
      : "EASY";
    return [{
      ...quest,
      id,
      title: typeof quest.title === "string" ? quest.title.slice(0, 200) : "Untitled quest",
      category: typeof quest.category === "string" ? quest.category.slice(0, 100) : "General",
      skill: typeof quest.skill === "string" ? quest.skill.slice(0, 100) : null,
      difficulty,
      xp: finiteNonNegative(quest.xp, 0),
      completed: Boolean(quest.completed),
      outcomeStatus: typeof quest.outcomeStatus === "string"
        && ["completed", "missed", "abandoned"].includes(quest.outcomeStatus)
        ? quest.outcomeStatus
        : undefined,
      estimatedDurationMinutes: Number.isInteger(quest.estimatedDurationMinutes)
        && quest.estimatedDurationMinutes >= 1 && quest.estimatedDurationMinutes <= 1440
        ? quest.estimatedDurationMinutes
        : undefined,
      reason: typeof quest.reason === "string" ? quest.reason.slice(0, 500) : "",
    }];
  });
}

function sanitizeHistory(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || !entry.id || seen.has(entry.id)) {
      return [];
    }
    const id = entry.id.slice(0, 200);
    if (seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      title: typeof entry.title === "string" ? entry.title.slice(0, 200) : "Completed quest",
      category: typeof entry.category === "string" ? entry.category.slice(0, 100) : "General",
      difficulty: typeof entry.difficulty === "string" ? entry.difficulty.slice(0, 30) : "—",
      xpEarned: finiteNonNegative(entry.xpEarned, 0),
      bossBonusXpEarned: finiteNonNegative(entry.bossBonusXpEarned, 0),
      badgeEarned: entry.badgeEarned && typeof entry.badgeEarned === "object" ? entry.badgeEarned : null,
      completedAt: typeof entry.completedAt === "string" ? entry.completedAt : "",
      localDate: validLocalDateKey(entry.localDate)
        ? entry.localDate
        : (entry.completedAt ? localDateKey(new Date(entry.completedAt)) : ""),
      ...(Number.isInteger(entry.estimatedDurationMinutes)
        && entry.estimatedDurationMinutes >= 1 && entry.estimatedDurationMinutes <= 1440
        ? { estimatedDurationMinutes: entry.estimatedDurationMinutes }
        : {}),
    }];
  });
}

function sanitizeActivityRecords(value, history) {
  const records = [];
  const seen = new Set();
  if (Array.isArray(value)) {
    for (const entry of value.slice(-1000)) {
      if (!entry || typeof entry !== "object" || typeof entry.questId !== "string" || !entry.questId
        || !["completed", "missed", "abandoned"].includes(entry.status) || seen.has(entry.questId)) continue;
      const recordedAt = typeof entry.recordedAt === "string" ? entry.recordedAt.slice(0, 40) : "";
      const actualDurationMinutes = normalizeActualDuration(entry.actualDurationMinutes);
      records.push({
        questId: entry.questId.slice(0, 200),
        title: typeof entry.title === "string" ? entry.title.slice(0, 200) : "Quest",
        category: typeof entry.category === "string" ? entry.category.slice(0, 100) : "General",
        difficulty: typeof entry.difficulty === "string" ? entry.difficulty.slice(0, 30) : "—",
        status: entry.status,
        recordedAt,
        localDate: validLocalDateKey(entry.localDate)
          ? entry.localDate
          : (recordedAt ? localDateKey(new Date(recordedAt)) : ""),
        ...(Number.isInteger(entry.estimatedDurationMinutes)
          && entry.estimatedDurationMinutes >= 1 && entry.estimatedDurationMinutes <= 1440
          ? { estimatedDurationMinutes: entry.estimatedDurationMinutes }
          : {}),
        ...((entry.status === "completed" || entry.status === "abandoned") && actualDurationMinutes !== null
          ? { actualDurationMinutes }
          : {}),
      });
      seen.add(entry.questId);
    }
  }
  for (const entry of history) {
    if (seen.has(entry.id)) continue;
    records.push({
      questId: entry.id,
      title: entry.title,
      category: entry.category,
      difficulty: entry.difficulty,
      status: "completed",
      recordedAt: entry.completedAt,
      localDate: entry.localDate,
      xpEarned: entry.xpEarned,
      ...(entry.estimatedDurationMinutes !== undefined
        ? { estimatedDurationMinutes: entry.estimatedDurationMinutes }
        : {}),
    });
    seen.add(entry.id);
  }
  return records.slice(-1000);
}

function sanitizeProgression(value, weeklyBoss) {
  const saved = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const history = sanitizeHistory(saved.history);
  const activityRecords = sanitizeActivityRecords(saved.activityRecords, history);
  const completedQuestIds = sanitizeStringList(saved.completedQuestIds);
  const historyIds = history.map((entry) => entry.id);
  const savedLevel = finiteNonNegative(saved.level, 1);
  const level = Math.max(1, Math.floor(savedLevel));
  const xp = Math.min(finiteNonNegative(saved.xp), level * 500 - 1);
  const skillPracticeXp = {};

  for (const skill of defaultSkills) {
    const amount = finiteNonNegative(saved.skillPracticeXp?.[skill], 0);
    if (amount > 0) skillPracticeXp[skill] = amount;
  }

  return {
    xp,
    level,
    totalXpEarned: finiteNonNegative(saved.totalXpEarned, history.reduce(
      (total, entry) => total + entry.xpEarned + entry.bossBonusXpEarned,
      0,
    )),
    skillPracticeXp,
    history,
    completedQuestIds: [...new Set([...completedQuestIds, ...historyIds])],
    activityRecords,
    weeklyBoss,
  };
}

function sanitizeSnapshot(value, storage, date) {
  const saved = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const character = saved.character && typeof saved.character === "object" && !Array.isArray(saved.character)
    ? saved.character
    : {};
  const goals = Array.isArray(saved.goals)
    ? saved.goals.filter((goal) => typeof goal === "string").map((goal) => goal.trim().slice(0, 300)).filter(Boolean)
    : [];
  const skills = Object.fromEntries(defaultSkills.map((skill) => {
    const score = finiteScore(saved.skills?.[skill]);
    return [skill, score ?? 50];
  }));
  const assessedSkills = sanitizeStringList(saved.assessedSkills, 100)
    .filter((skill) => defaultSkills.includes(skill));
  const questGeneration = Math.floor(finiteNonNegative(saved.questGeneration, 0));
  const weeklyBoss = saved.progression?.weeklyBoss
    ? getWeeklyBossForDate(saved.progression.weeklyBoss, date)
    : loadWeeklyBossState(storage, date);
  const progression = sanitizeProgression(saved.progression, weeklyBoss);
  const quests = sanitizeQuests(saved.quests);
  const completedIds = new Set([
    ...progression.completedQuestIds,
    ...quests.filter((quest) => quest.completed).map((quest) => quest.id),
  ]);
  progression.completedQuestIds = [...completedIds];
  const reconciledQuests = quests.map((quest) => ({
    ...quest,
    completed: quest.completed || completedIds.has(quest.id),
  }));
  const finalQuests = reconciledQuests.length
    ? reconciledQuests
    : generateDailyQuests({ goals, skills, assessedSkills, generation: questGeneration });
  const finalQuestIds = new Set(finalQuests.filter((quest) => quest.completed).map((quest) => quest.id));
  progression.completedQuestIds = [...new Set([...progression.completedQuestIds, ...finalQuestIds])];
  const outcomesByQuestId = new Map(progression.activityRecords.map((entry) => [entry.questId, entry.status]));
  const consistentQuests = finalQuests.map((quest) => {
    const outcomeStatus = outcomesByQuestId.get(quest.id) || (quest.completed ? "completed" : undefined);
    return {
      ...quest,
      ...(outcomeStatus ? { outcomeStatus } : {}),
      completed: quest.completed || outcomeStatus === "completed"
        || progression.completedQuestIds.includes(quest.id),
    };
  });

  return {
    character: {
      name: typeof character.name === "string" ? character.name.trim().slice(0, 32) : "",
      age: typeof character.age === "string" ? character.age.slice(0, 20) : "",
      avatar: typeof character.avatar === "string" ? character.avatar.slice(0, 16) : "🧑‍💻",
    },
    goals,
    skills,
    assessedSkills,
    gameStyle: typeof saved.gameStyle === "string" ? saved.gameStyle.slice(0, 40) : "Mix",
    questGeneration,
    quests: consistentQuests,
    progression,
    showDashboard: typeof saved.showDashboard === "boolean"
      ? saved.showDashboard
      : Boolean(typeof character.name === "string" && character.name.trim()),
  };
}

export function loadGameState(storage = getBrowserStorage(), date = new Date()) {
  let saved = null;
  try {
    const raw = storage?.getItem(GAME_STATE_STORAGE_KEY);
    saved = raw ? JSON.parse(raw) : null;
  } catch {
    saved = null;
  }
  return sanitizeSnapshot(saved, storage, date);
}

export function persistGameState(state, storage = getBrowserStorage()) {
  if (!state || !storage) return false;
  try {
    storage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(state));
    persistWeeklyBossState(state.progression?.weeklyBoss, storage);
    return true;
  } catch {
    // Storage may be unavailable or full; keep the running game usable.
    return false;
  }
}
