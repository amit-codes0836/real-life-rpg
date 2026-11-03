import { defaultSkills } from "../data/skills.js";
import { questTemplates } from "../data/quests.js";

const DIFFICULTY_PLAN = ["EASY", "MEDIUM", "MEDIUM", "HARD", "EASY"];
const XP_BY_DIFFICULTY = {
  EASY: 25,
  MEDIUM: 45,
  HARD: 70,
};

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const goalContainsKeyword = (goal, keyword) => {
  const normalizedGoal = normalize(goal);
  const normalizedKeyword = normalize(keyword);
  return ` ${normalizedGoal} `.includes(` ${normalizedKeyword} `);
};

const getActiveGoals = (goals) =>
  Array.isArray(goals)
    ? goals.map((goal) => String(goal || "").trim()).filter(Boolean)
    : [];

const findGoalMatch = (template, goals) => {
  const keywords = template.goalKeywords || [];
  return goals.find((goal) =>
    keywords.some((keyword) => goalContainsKeyword(goal, keyword))
  );
};

const inferGoalCategory = (goal) => {
  const normalizedGoal = normalize(goal);
  for (const skill of defaultSkills) {
    const normalizedSkill = normalize(skill);
    if (normalizedGoal.includes(normalizedSkill)) return skill;
  }

  const matchingTemplate = questTemplates.find((template) =>
    template.goalKeywords.some((keyword) =>
      goalContainsKeyword(goal, keyword)
    )
  );
  return matchingTemplate?.skill || "Personal Goal";
};

const truncate = (value, maxLength = 58) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1).trim()}…` : value;

const localDateKey = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

/**
 * Generates a stable set for the same inputs, date, and generation number.
 * Only assessed skill scores influence prioritization; other skills remain eligible
 * without being treated as measured.
 */
export function generateDailyQuests({
  goals = [],
  skills = {},
  assessedSkills = [],
  generation = 0,
  dateKey = localDateKey(),
} = {}) {
  const activeGoals = getActiveGoals(goals);
  const assessed = new Set(Array.isArray(assessedSkills) ? assessedSkills : []);
  const selected = [];
  const usedTemplateIds = new Set();
  const normalizedGeneration = Math.max(0, Number(generation) || 0);

  const goalIndex = activeGoals.length
    ? normalizedGeneration % activeGoals.length
    : -1;
  const primaryGoal = goalIndex >= 0 ? activeGoals[goalIndex] : null;
  const goalQuestSlot = normalizedGeneration % DIFFICULTY_PLAN.length;

  const addQuest = ({ id, title, category, skill, difficulty, reason }) => {
    const uniqueId = `daily-${dateKey}-run${normalizedGeneration}-${id}`;
    selected.push({
      id: uniqueId,
      title,
      category,
      difficulty,
      xp: XP_BY_DIFFICULTY[difficulty],
      completed: false,
      reason,
      skill,
    });
  };

  DIFFICULTY_PLAN.forEach((difficulty, index) => {
    const pool = questTemplates
      .filter((template) => template.difficulty === difficulty && !usedTemplateIds.has(template.id))
      .map((template) => {
        const matchedGoal = findGoalMatch(template, activeGoals);
        const isAssessed = assessed.has(template.skill);
        const skillScore = Number(skills?.[template.skill]);
        const weakness = isAssessed && Number.isFinite(skillScore)
          ? 100 - Math.max(0, Math.min(100, skillScore))
          : 0;
        const rotation = (questTemplates.indexOf(template) + normalizedGeneration * 3) % questTemplates.length;
        const matchedPrimaryGoal = primaryGoal
          ? findGoalMatch(template, [primaryGoal])
          : null;
        return { template, matchedGoal, matchedPrimaryGoal, weakness, rotation };
      })
      .sort((left, right) => {
        return right.weakness - left.weakness
          || Number(Boolean(right.matchedGoal)) - Number(Boolean(left.matchedGoal))
          || left.rotation - right.rotation;
      });

    const primaryGoalMatches = index === goalQuestSlot
      ? pool.filter((candidate) => candidate.matchedPrimaryGoal)
      : [];
    const choice = primaryGoalMatches[0] || (index === goalQuestSlot && primaryGoal
      ? null
      : pool[0]);

    if (index === goalQuestSlot && primaryGoal && !choice) {
      const category = inferGoalCategory(primaryGoal);
      addQuest({
        id: `goal-${goalIndex}`,
        title: `Make progress on: ${truncate(primaryGoal)}`,
        category,
        skill: defaultSkills.includes(category) ? category : null,
        difficulty,
        reason: `Personalized from your goal: ${primaryGoal}`,
      });
      return;
    }

    if (!choice) return;

    const { template, matchedGoal } = choice;
    usedTemplateIds.add(template.id);
    addQuest({
      id: template.id,
      title: template.title,
      category: template.skill,
      skill: template.skill,
      difficulty: template.difficulty,
      reason: matchedGoal
        ? `Related to your goal: ${matchedGoal}`
        : assessed.has(template.skill) && Number.isFinite(Number(skills?.[template.skill]))
          ? `Practice for ${template.skill}; your assessed score is ${Math.max(0, Math.min(100, Number(skills[template.skill])))}.`
          : template.reason,
    });
  });

  return selected;
}
