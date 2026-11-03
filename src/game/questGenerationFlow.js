const hasQuestSet = (value) => Array.isArray(value) && value.length > 0;

const errorMessage = (error, fallback) =>
  error instanceof Error && error.message ? error.message : fallback;

/** Returns a nonempty AI/local replacement or the original board unchanged. */
export async function generateQuestSetWithFallback({
  requestAI,
  generateLocal,
  currentQuests = [],
}) {
  let aiError = null;
  try {
    const aiQuests = await requestAI();
    if (hasQuestSet(aiQuests)) {
      return { quests: aiQuests, source: "ai", error: "" };
    }
    aiError = new Error("The Game Master returned an empty quest set.");
  } catch (error) {
    aiError = error;
  }

  try {
    const localQuests = await generateLocal();
    if (hasQuestSet(localQuests)) {
      return {
        quests: localQuests,
        source: "local",
        error: `${errorMessage(aiError, "The Game Master could not generate quests.")} Local quests are shown instead.`,
      };
    }
  } catch {
    // Keep the current board intact if the local fallback itself fails.
  }

  return {
    quests: currentQuests,
    source: "existing",
    error: `${errorMessage(aiError, "The Game Master could not generate quests.")} Local quest generation failed. Existing quests were kept.`,
  };
}
