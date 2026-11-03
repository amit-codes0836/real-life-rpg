const PLAYER_SKILLS = [
  "Coding", "DSA", "AI / ML", "Backend", "Communication", "English",
  "Fitness", "Business", "Creativity", "Discipline",
];

const DIFFICULTIES = new Set(["EASY", "MEDIUM", "HARD"]);
const MAX_GOALS = 20;
const MAX_ACTIVITY_OUTCOMES = 20;
const MAX_CONTEXT_HISTORY = 10;
const MAX_ACTIVE_QUEST_TITLES = 10;
const CONSISTENT_PRACTICE_THRESHOLD = 3;
const MIN_DIFFICULTY_EVIDENCE = 5;
const DIFFICULTY_ORDER = ["EASY", "MEDIUM", "HARD"];
const GOAL_MATCH_STOP_WORDS = new Set([
  "the", "and", "for", "one", "with", "from", "your", "into", "this", "that",
  "practice", "practicing", "learn", "learning", "improve", "improving", "small",
  "goal", "goals", "skill", "skills", "make", "build", "create", "work", "better",
]);

const cleanText = (value, maxLength) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const finiteNonNegative = (value, fallback = null) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};

const normalizeDifficulty = (value) => {
  const difficulty = String(value || "").toUpperCase();
  return DIFFICULTIES.has(difficulty) ? difficulty : "EASY";
};

function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_CONTEXT_HISTORY).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const title = cleanText(entry.title, 120);
    if (!title) return [];
    return [{
      title,
      category: PLAYER_SKILLS.includes(entry.category) ? entry.category : "Personal Goal",
      difficulty: normalizeDifficulty(entry.difficulty),
      ...(typeof (entry.completedAt || entry.recordedAt) === "string"
        ? { completedAt: (entry.completedAt || entry.recordedAt).slice(0, 40) }
        : {}),
    }];
  });
}

function normalizeActivityLog(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_ACTIVITY_OUTCOMES).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const status = String(entry.status || "").toLowerCase();
    if (status !== "completed" && status !== "missed" && status !== "abandoned") return [];
    const title = cleanText(entry.title, 120);
    if (!title) return [];
    return [{
      title,
      status,
      difficulty: normalizeDifficulty(entry.difficulty),
      category: PLAYER_SKILLS.includes(entry.category) ? entry.category : "Personal Goal",
      ...(typeof (entry.completedAt || entry.recordedAt) === "string"
        ? { completedAt: (entry.completedAt || entry.recordedAt).slice(0, 40) }
        : {}),
    }];
  });
}

function normalizeActiveQuestTitles(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((quest) => {
    if (!quest || typeof quest !== "object" || Array.isArray(quest) || quest.completed) return [];
    const title = cleanText(quest.title, 100);
    return title ? [title] : [];
  }))].slice(0, MAX_ACTIVE_QUEST_TITLES);
}

function mergeRecordedOutcomes(history, activityLog) {
  const explicitActivity = [...activityLog].reverse();
  const completedHistory = history.map((entry) => ({ ...entry, status: "completed" }));
  const outcomes = [];
  const seenExact = new Set();
  const seenUntimed = new Set();

  for (const outcome of [...explicitActivity, ...completedHistory]) {
    const signature = [
      outcome.status,
      outcome.title.toLocaleLowerCase(),
      outcome.category,
      outcome.difficulty,
    ].join("|");
    const timestamp = outcome.completedAt || "";
    const exactKey = `${signature}|${timestamp}`;
    if (seenExact.has(exactKey) || (timestamp && seenUntimed.has(signature))) continue;
    if (!timestamp && outcomes.some((existing) => {
      const existingSignature = [
        existing.status,
        existing.title.toLocaleLowerCase(),
        existing.category,
        existing.difficulty,
      ].join("|");
      return existingSignature === signature;
    })) continue;

    seenExact.add(exactKey);
    if (!timestamp) seenUntimed.add(signature);
    outcomes.push(outcome);
  }
  return outcomes.slice(0, MAX_ACTIVITY_OUTCOMES);
}

function buildConsistency(outcomes) {
  const completed = outcomes.filter((activity) => activity.status === "completed");
  const missed = outcomes.filter((activity) => activity.status === "missed");
  const abandoned = outcomes.filter((activity) => activity.status === "abandoned");
  const outcomeCount = completed.length + missed.length + abandoned.length;
  const completionRate = outcomeCount > 0 ? completed.length / outcomeCount : null;

  let difficultyGuidance = "hold";
  if (outcomeCount >= MIN_DIFFICULTY_EVIDENCE && completionRate >= 0.8) {
    difficultyGuidance = "slight_increase";
  } else if (outcomeCount >= MIN_DIFFICULTY_EVIDENCE && completionRate <= 0.4) {
    difficultyGuidance = "slight_decrease";
  }

  return {
    completedCount: completed.length,
    missedCount: missed.length,
    abandonedCount: abandoned.length,
    outcomeCount,
    completionRate,
    missedQuests: missed.slice(-10).map(({ title, difficulty }) => ({ title, difficulty })),
    difficultyGuidance,
  };
}

function normalizeSkillPracticeXp(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(PLAYER_SKILLS.flatMap((skill) => {
    const amount = finiteNonNegative(value[skill]);
    return amount === null || amount === 0
      ? []
      : [[skill, Math.min(1_000_000, Math.floor(amount))]];
  }));
}

function meaningfulTokens(value) {
  return new Set((cleanText(value, 160).toLocaleLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((token) => token.length >= 3 && !GOAL_MATCH_STOP_WORDS.has(token)));
}

function buildGoalCoverage(goals, completedOutcomes) {
  return goals.map((goal) => {
    const goalTokens = meaningfulTokens(goal);
    const matchingCompletions = completedOutcomes.filter((entry) => {
      const completionTokens = meaningfulTokens(`${entry.title} ${entry.category}`);
      return [...goalTokens].some((token) => completionTokens.has(token));
    }).length;
    return {
      goal,
      recentQuestMatchCount: matchingCompletions,
      signal: matchingCompletions === 0
        ? "no_recent_recorded_match"
        : matchingCompletions === 1
          ? "limited_recent_recorded_match"
          : "recently_supported",
    };
  });
}

function buildPerformanceInsights({ goals, assessedSkills, outcomes, skillPracticeXp, consistency }) {
  const completed = outcomes.filter((outcome) => outcome.status === "completed");
  const assessedScores = new Map(assessedSkills.map(({ skill, score }) => [skill, score]));
  const skillPractice = PLAYER_SKILLS.map((skill) => {
    const recentCompletionCount = completed.filter((entry) => entry.category === skill).length;
    return {
      skill,
      assessedScore: assessedScores.get(skill) ?? null,
      recentCompletionCount,
      lifetimePracticeXp: skillPracticeXp[skill] || 0,
      pattern: recentCompletionCount >= CONSISTENT_PRACTICE_THRESHOLD
        ? "consistent_recent_practice"
        : recentCompletionCount > 0
          ? "some_recent_practice"
          : "no_recent_recorded_practice",
    };
  });

  const categoryCounts = new Map();
  for (const entry of completed) {
    categoryCounts.set(entry.category, (categoryCounts.get(entry.category) || 0) + 1);
  }
  const recentQuestTypeCounts = [...categoryCounts]
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));

  const baselineDifficulty = outcomes[0]?.difficulty || null;
  let allowedDifficulties = null;
  if (consistency.outcomeCount >= MIN_DIFFICULTY_EVIDENCE && baselineDifficulty) {
    const baselineIndex = DIFFICULTY_ORDER.indexOf(baselineDifficulty);
    if (consistency.difficultyGuidance === "slight_increase") {
      allowedDifficulties = DIFFICULTY_ORDER.slice(baselineIndex, baselineIndex + 2);
    } else if (consistency.difficultyGuidance === "slight_decrease") {
      allowedDifficulties = DIFFICULTY_ORDER.slice(Math.max(0, baselineIndex - 1), baselineIndex + 1);
    } else {
      allowedDifficulties = [baselineDifficulty];
    }
  }

  return {
    outcomeCount: consistency.outcomeCount,
    minimumDifficultyEvidence: MIN_DIFFICULTY_EVIDENCE,
    difficultyGuidance: consistency.difficultyGuidance,
    recentBaselineDifficulty: baselineDifficulty,
    allowedDifficulties,
    consistentlyPracticedSkills: skillPractice
      .filter((entry) => entry.pattern === "consistent_recent_practice")
      .map(({ skill }) => skill),
    skillPractice,
    recentQuestTypeCounts,
    goalCoverage: buildGoalCoverage(goals, completed),
  };
}

function normalizeWeeklyBoss(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const targetHp = finiteNonNegative(value.targetHp);
  const currentHp = finiteNonNegative(value.currentHp);
  if (targetHp === null || targetHp <= 0 || currentHp === null) return null;
  return {
    name: cleanText(value.name, 100) || "Weekly Boss",
    description: cleanText(value.description, 240),
    targetHp: Math.min(100_000, targetHp),
    currentHp: Math.min(Math.min(100_000, targetHp), currentHp),
    defeated: Boolean(value.defeated) || currentHp <= 0,
  };
}

/**
 * Converts browser game state into a bounded, privacy-minimized context for the
 * Game Master. Missed quests are included only when explicitly marked as missed.
 */
export function buildPlayerContext(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const characterName = cleanText(input.character?.name, 32);
  const goals = Array.isArray(input.goals)
    ? [...new Set(input.goals
        .filter((goal) => typeof goal === "string")
        .map((goal) => goal.trim().slice(0, 160))
        .filter(Boolean))]
      .slice(0, MAX_GOALS)
    : [];

  const assessedSkills = new Set(Array.isArray(input.assessedSkills)
    ? input.assessedSkills.filter((skill) => PLAYER_SKILLS.includes(skill))
    : []);
  const assessed = [...assessedSkills].flatMap((skill) => {
    const score = finiteNonNegative(input.skills?.[skill]);
    return score !== null && score <= 100 ? [{ skill, score }] : [];
  });

  const progression = input.progression && typeof input.progression === "object"
    ? input.progression
    : {};
  const level = finiteNonNegative(progression.level);
  const xp = finiteNonNegative(progression.xp);
  const totalXpEarned = finiteNonNegative(progression.totalXpEarned);
  const availableTime = finiteNonNegative(input.availableTimeMinutes);
  const skillPracticeXp = normalizeSkillPracticeXp(progression.skillPracticeXp);
  const activityLog = normalizeActivityLog(input.activityLog);
  const recentCompletions = normalizeHistory(input.history);
  const outcomes = mergeRecordedOutcomes(recentCompletions, activityLog);
  const consistency = buildConsistency(outcomes);
  const performance = buildPerformanceInsights({
    goals,
    assessedSkills: assessed,
    outcomes,
    skillPracticeXp,
    consistency,
  });

  return {
    character: characterName ? { displayName: characterName } : {},
    goals,
    skills: {
      assessed,
      unassessed: PLAYER_SKILLS.filter((skill) => !assessedSkills.has(skill)),
    },
    progression: {
      level: level === null ? null : Math.max(1, Math.floor(level)),
      xp: xp === null ? null : Math.floor(xp),
      totalXpEarned: totalXpEarned === null ? null : Math.floor(totalXpEarned),
      skillPracticeXp,
    },
    recentCompletions,
    activeQuestTitles: normalizeActiveQuestTitles(input.currentQuests),
    consistency,
    performance,
    availableTimeMinutes: availableTime === null
      ? null
      : Math.min(1440, Math.floor(availableTime)),
    weeklyBoss: normalizeWeeklyBoss(input.weeklyBoss),
  };
}
