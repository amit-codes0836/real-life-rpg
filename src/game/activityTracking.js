const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TRACKED_MINUTES = 24 * 60;

export function localDateKey(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function validLocalDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function normalizeActualDuration(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_TRACKED_MINUTES
    ? minutes
    : null;
}

function shiftDateKey(key, offset) {
  if (!validLocalDateKey(key)) return "";
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
}

export function calculateCurrentStreak(activityRecords = [], today = new Date()) {
  const todayKey = localDateKey(today);
  if (!todayKey) return 0;
  const completedDays = new Set(activityRecords
    .filter((entry) => entry?.status === "completed" && validLocalDateKey(entry.localDate))
    .map((entry) => entry.localDate));
  let cursor = completedDays.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1);
  if (!completedDays.has(cursor)) return 0;
  let streak = 0;
  while (completedDays.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

function dateForRecord(entry) {
  if (validLocalDateKey(entry?.localDate)) return entry.localDate;
  const timestamp = entry?.completedAt || entry?.recordedAt;
  if (typeof timestamp !== "string") return "";
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : localDateKey(date);
}

export function buildActivitySummary({ quests = [], progression = {}, now = new Date() } = {}) {
  const records = Array.isArray(progression.activityRecords) ? progression.activityRecords : [];
  const history = Array.isArray(progression.history) ? progression.history : [];
  const today = localDateKey(now);
  const todayRecords = records.filter((entry) => dateForRecord(entry) === today);
  const terminalIds = new Set(records.map((entry) => entry.questId));
  const pending = quests.filter((quest) => quest && !terminalIds.has(quest.id)
    && !quest.completed && !quest.outcomeStatus);
  const countStatus = (items, status) => items.filter((entry) => entry.status === status).length;
  const historyInPeriod = (start, end) => history.filter((entry) => {
    const date = dateForRecord(entry);
    return date >= start && date <= end;
  });
  const sumXp = (entries) => entries.reduce((total, entry) =>
    total + (Number(entry.xpEarned) || 0) + (Number(entry.bossBonusXpEarned) || 0), 0);
  const todayHistory = historyInPeriod(today, today);

  const weekStart = shiftDateKey(today, -6);
  const weekRecords = records.filter((entry) => {
    const date = dateForRecord(entry);
    return date >= weekStart && date <= today;
  });
  const weekHistory = historyInPeriod(weekStart, today);
  const completedInWeek = countStatus(weekRecords, "completed");
  const missedInWeek = countStatus(weekRecords, "missed");
  const abandonedInWeek = countStatus(weekRecords, "abandoned");
  const outcomeCount = completedInWeek + missedInWeek + abandonedInWeek;
  const skillPracticeXp = {};
  for (const entry of weekHistory) {
    if (typeof entry.category === "string") {
      skillPracticeXp[entry.category] = (skillPracticeXp[entry.category] || 0) + (Number(entry.xpEarned) || 0);
    }
  }
  const activeDays = new Set(weekRecords
    .filter((entry) => entry.status === "completed")
    .map(dateForRecord)
    .filter(Boolean)).size;

  return {
    today: {
      completed: countStatus(todayRecords, "completed"),
      missed: countStatus(todayRecords, "missed"),
      abandoned: countStatus(todayRecords, "abandoned"),
      pending: pending.length,
      xpEarned: sumXp(todayHistory),
      actualMinutes: todayRecords.reduce((total, entry) => total + (entry.actualDurationMinutes || 0), 0),
      timedOutcomeCount: todayRecords.filter((entry) => Number.isInteger(entry.actualDurationMinutes)).length,
    },
    week: {
      startDate: weekStart,
      endDate: today,
      completed: completedInWeek,
      missed: missedInWeek,
      abandoned: abandonedInWeek,
      outcomeCount,
      completionRate: outcomeCount ? completedInWeek / outcomeCount : null,
      xpEarned: sumXp(weekHistory),
      skillPracticeXp,
      activeDays,
      currentStreak: calculateCurrentStreak(records, now),
    },
  };
}
