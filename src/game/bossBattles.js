import { weeklyBosses } from "../data/weeklyBosses.js";

export const WEEKLY_BOSS_STORAGE_KEY = "real-life-rpg.weekly-boss.v1";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MONDAY_EPOCH_UTC = Date.UTC(1970, 0, 5);

function getLocalMonday(date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysSinceMonday);
  return monday;
}

export function getWeekKey(date = new Date()) {
  const monday = getLocalMonday(date);
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const day = String(monday.getDate()).padStart(2, "0");
  return `${monday.getFullYear()}-${month}-${day}`;
}

function getWeekIndex(date) {
  const monday = getLocalMonday(date);
  const mondayUtc = Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate());
  return Math.floor((mondayUtc - MONDAY_EPOCH_UTC) / WEEK_MS);
}

function getStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function makeBossForWeek(date, earnedRewards = []) {
  const weekIndex = getWeekIndex(date);
  const bossIndex = ((weekIndex % weeklyBosses.length) + weeklyBosses.length) % weeklyBosses.length;
  const template = weeklyBosses[bossIndex];

  return {
    ...template,
    badge: { ...template.badge },
    weekKey: getWeekKey(date),
    currentHp: template.targetHp,
    defeated: false,
    rewardClaimed: false,
    processedQuestIds: [],
    earnedRewards: Array.isArray(earnedRewards) ? earnedRewards : [],
  };
}

function normalizeSavedBoss(saved, date) {
  if (!saved || saved.weekKey !== getWeekKey(date)) return null;

  const template = weeklyBosses.find((boss) => boss.id === saved.id);
  if (!template) return null;

  const rawHp = Number(saved.currentHp);
  const currentHp = saved.defeated
    ? 0
    : Math.max(0, Math.min(template.targetHp, Number.isFinite(rawHp) ? rawHp : template.targetHp));
  const earnedRewards = (Array.isArray(saved.earnedRewards) ? saved.earnedRewards : [])
    .filter((reward) => reward && typeof reward.bossId === "string")
    .map((reward) => {
      const earnedBoss = weeklyBosses.find((boss) => boss.id === reward.bossId);
      return earnedBoss && typeof reward.weekKey === "string"
        ? {
            bossId: earnedBoss.id,
            weekKey: reward.weekKey,
            rewardXp: earnedBoss.rewardXp,
            badge: { ...earnedBoss.badge },
            earnedAt: typeof reward.earnedAt === "string" ? reward.earnedAt : "",
          }
        : null;
    })
    .filter(Boolean);
  const rewardAlreadyStored = earnedRewards.some((reward) => reward?.bossId === template.id && reward?.weekKey === saved.weekKey);
  const defeated = Boolean(saved.defeated) || currentHp === 0;

  return {
    ...template,
    badge: { ...template.badge },
    weekKey: saved.weekKey,
    currentHp,
    defeated,
    rewardClaimed: Boolean(saved.rewardClaimed) || rewardAlreadyStored,
    processedQuestIds: Array.isArray(saved.processedQuestIds) ? saved.processedQuestIds : [],
    earnedRewards,
  };
}

export function getWeeklyBossForDate(currentBoss, date = new Date()) {
  const normalized = normalizeSavedBoss(currentBoss, date);
  if (normalized) return normalized;
  return makeBossForWeek(date, currentBoss?.earnedRewards);
}

export function loadWeeklyBossState(storage = getStorage(), date = new Date()) {
  let saved = null;
  try {
    const raw = storage?.getItem(WEEKLY_BOSS_STORAGE_KEY);
    saved = raw ? JSON.parse(raw) : null;
  } catch {
    saved = null;
  }

  return getWeeklyBossForDate(saved, date);
}

export function persistWeeklyBossState(boss, storage = getStorage()) {
  if (!boss || !storage) return;
  try {
    storage.setItem(WEEKLY_BOSS_STORAGE_KEY, JSON.stringify(boss));
  } catch {
    // Storage can be unavailable in private browsing or when the quota is full.
  }
}

const DAMAGE_BY_DIFFICULTY = {
  EASY: 20,
  MEDIUM: 30,
  HARD: 45,
};

export function damageWeeklyBoss(currentBoss, quest, completedAt = new Date().toISOString()) {
  if (!currentBoss) {
    return { boss: null, damage: 0, bonusXp: 0, badgeAwarded: null };
  }

  const date = new Date(completedAt);
  const boss = getWeeklyBossForDate(currentBoss, Number.isNaN(date.getTime()) ? new Date() : date);

  if (!quest || quest.id == null || boss.defeated || boss.processedQuestIds.includes(quest.id)) {
    return { boss, damage: 0, bonusXp: 0, badgeAwarded: null };
  }

  const difficulty = String(quest.difficulty || "").toUpperCase();
  const damage = DAMAGE_BY_DIFFICULTY[difficulty] || DAMAGE_BY_DIFFICULTY.EASY;
  const currentHp = Math.max(0, boss.currentHp - damage);
  const defeated = currentHp === 0;
  const rewardClaimed = boss.rewardClaimed || defeated;
  const bonusXp = defeated && !boss.rewardClaimed ? boss.rewardXp : 0;
  const badgeAwarded = bonusXp > 0 ? boss.badge : null;
  const earnedRewards = bonusXp > 0
    ? [...boss.earnedRewards, {
        bossId: boss.id,
        weekKey: boss.weekKey,
        rewardXp: boss.rewardXp,
        badge: boss.badge,
        earnedAt: completedAt,
      }]
    : boss.earnedRewards;

  return {
    boss: {
      ...boss,
      currentHp,
      defeated,
      rewardClaimed,
      processedQuestIds: [...boss.processedQuestIds, quest.id],
      earnedRewards,
    },
    damage,
    bonusXp,
    badgeAwarded,
  };
}
