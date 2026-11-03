import { getSkillForQuest } from "./progression.js";

/** Derive presentation-only feedback from the authoritative progression result. */
export function buildCompletionFeedback(previous, next, quest) {
  if (!previous || !next || next === previous || !quest?.id) return null;
  const completion = next.history?.find((entry) => entry.id === quest.id);
  if (!completion) return null;

  const skill = getSkillForQuest(quest);
  const skillPracticeXp = skill
    ? Math.max(0, (next.skillPracticeXp?.[skill] || 0) - (previous.skillPracticeXp?.[skill] || 0))
    : 0;
  const sameBoss = previous.weeklyBoss?.id
    && previous.weeklyBoss.id === next.weeklyBoss?.id;
  const bossDamage = sameBoss
    ? Math.max(0, (previous.weeklyBoss.currentHp || 0) - (next.weeklyBoss.currentHp || 0))
    : 0;

  return {
    questId: quest.id,
    xpEarned: Math.max(0, next.totalXpEarned - previous.totalXpEarned),
    questXp: completion.xpEarned || 0,
    bossBonusXp: completion.bossBonusXpEarned || 0,
    skill,
    skillPracticeXp,
    skillPracticeTotal: skill ? next.skillPracticeXp?.[skill] || 0 : 0,
    levelUp: next.level > previous.level,
    level: next.level,
    bossDamage,
  };
}
