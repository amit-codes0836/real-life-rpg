import { defaultSkills } from "../data/skills.js";
import { damageWeeklyBoss } from "./bossBattles.js";
import { calculateXP } from "./xpSystem.js";
import { localDateKey, normalizeActualDuration } from "./activityTracking.js";

const normalizeSkill = (value) =>
  String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const skillByNormalizedName = new Map(
  defaultSkills.map((skill) => [normalizeSkill(skill), skill])
);

const skillAliases = new Map([
  ["aimachinelearning", "AI / ML"],
  ["artificialintelligencemachinelearning", "AI / ML"],
]);

const estimatedDuration = (quest) => Number.isInteger(quest?.estimatedDurationMinutes)
  && quest.estimatedDurationMinutes >= 1 && quest.estimatedDurationMinutes <= 1440
  ? quest.estimatedDurationMinutes
  : null;

export function getSkillForQuest(quest) {
  const candidates = [quest?.skill, quest?.category];

  for (const candidate of candidates) {
    const normalized = normalizeSkill(candidate);
    const skill = skillByNormalizedName.get(normalized) || skillAliases.get(normalized);
    if (skill) return skill;
  }

  return null;
}

export function createInitialProgression(weeklyBoss = null) {
  return {
    xp: 0,
    level: 1,
    totalXpEarned: 0,
    skillPracticeXp: {},
    history: [],
    completedQuestIds: [],
    activityRecords: [],
    weeklyBoss,
  };
}

/** Adds one completed quest to overall progression, skill practice, and history. */
export function recordQuestCompletion(progress, quest, completedAt = new Date().toISOString(), details = {}) {
  if (!quest || quest.id == null || (progress.completedQuestIds || []).includes(quest.id)
    || progress.activityRecords?.some((entry) => entry.questId === quest.id)) {
    return progress;
  }

  const earnedXp = Number.isFinite(Number(quest.xp)) && Number(quest.xp) > 0
    ? Number(quest.xp)
    : 0;
  const bossResult = damageWeeklyBoss(progress.weeklyBoss, quest, completedAt);
  const xpAfterQuest = calculateXP(progress.xp, progress.level, earnedXp);
  const nextOverall = bossResult.bonusXp > 0
    ? calculateXP(xpAfterQuest.xp, xpAfterQuest.level, bossResult.bonusXp)
    : xpAfterQuest;
  const skill = getSkillForQuest(quest);
  const estimatedDurationMinutes = estimatedDuration(quest);
  const historyEntry = {
    id: quest.id,
    title: quest.title,
    category: quest.category || "General",
    difficulty: quest.difficulty || "—",
    xpEarned: earnedXp,
    bossBonusXpEarned: bossResult.bonusXp,
    badgeEarned: bossResult.badgeAwarded,
    completedAt,
    localDate: details.localDate || localDateKey(new Date(completedAt)),
    ...(estimatedDurationMinutes !== null
      ? { estimatedDurationMinutes }
      : {}),
  };
  const actualDurationMinutes = normalizeActualDuration(details.actualDurationMinutes);
  const activityRecord = {
    questId: quest.id,
    title: quest.title || "Completed quest",
    category: quest.category || "General",
    difficulty: quest.difficulty || "—",
    status: "completed",
    recordedAt: completedAt,
    localDate: details.localDate || localDateKey(new Date(completedAt)),
    ...(estimatedDurationMinutes !== null
      ? { estimatedDurationMinutes }
      : {}),
    ...(actualDurationMinutes !== null ? { actualDurationMinutes } : {}),
  };

  return {
    ...progress,
    xp: nextOverall.xp,
    level: nextOverall.level,
    totalXpEarned: progress.totalXpEarned + earnedXp + bossResult.bonusXp,
    skillPracticeXp: skill
      ? {
          ...progress.skillPracticeXp,
          [skill]: (progress.skillPracticeXp[skill] || 0) + earnedXp,
        }
      : progress.skillPracticeXp,
    history: [historyEntry, ...progress.history],
    completedQuestIds: [...progress.completedQuestIds, quest.id],
    activityRecords: [...(progress.activityRecords || []), activityRecord],
    weeklyBoss: bossResult.boss,
  };
}

/** Records a terminal non-completion outcome without changing any rewards. */
export function recordQuestOutcome(progress, quest, status, details = {}) {
  if (!quest || quest.id == null || !["missed", "abandoned"].includes(status)
    || (progress.completedQuestIds || []).includes(quest.id)
    || progress.activityRecords?.some((entry) => entry.questId === quest.id)) {
    return progress;
  }
  const recordedAt = details.recordedAt || new Date().toISOString();
  const estimatedDurationMinutes = estimatedDuration(quest);
  const record = {
    questId: quest.id,
    title: quest.title || "Quest",
    category: quest.category || "General",
    difficulty: quest.difficulty || "—",
    status,
    recordedAt,
    localDate: details.localDate || localDateKey(new Date(recordedAt)),
    ...(estimatedDurationMinutes !== null
      ? { estimatedDurationMinutes }
      : {}),
    ...(status === "abandoned" && normalizeActualDuration(details.actualDurationMinutes) !== null
      ? { actualDurationMinutes: normalizeActualDuration(details.actualDurationMinutes) }
      : {}),
  };
  return { ...progress, activityRecords: [...(progress.activityRecords || []), record] };
}
