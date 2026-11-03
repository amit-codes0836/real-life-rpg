export function getXPRequired(level) {
  return level * 500;
}

export function calculateXP(currentXP, currentLevel, earnedXP) {
  const xpRequired = getXPRequired(currentLevel);

  const newXP = currentXP + earnedXP;

  if (newXP >= xpRequired) {
    return {
      xp: newXP - xpRequired,
      level: currentLevel + 1,
    };
  }

  return {
    xp: newXP,
    level: currentLevel,
  };
}