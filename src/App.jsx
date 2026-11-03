import { useEffect, useRef, useState } from "react";

import Dashboard from "./components/Dashboard";
import CharacterCreation from "./components/CharacterCreation";
import SkillAssessment from "./components/SkillAssessment";

import { defaultSkills } from "./data/skills";
import { generateDailyQuests } from "./game/questGenerator";
import { createInitialProgression, recordQuestCompletion, recordQuestOutcome } from "./game/progression.js";
import { loadGameState, persistGameState } from "./game/appPersistence.js";
import { localDateKey, normalizeActualDuration } from "./game/activityTracking.js";
import { buildCompletionFeedback } from "./game/gameplayFeedback.js";
import { requestGameMasterQuests } from "./game/gameMasterClient.js";
import { generateQuestSetWithFallback } from "./game/questGenerationFlow.js";

const DEFAULT_AVAILABLE_TIME_MINUTES = 30;

function App() {
  const initialState = useRef(null);
  if (initialState.current === null) {
    initialState.current = loadGameState();
  }
  const saved = initialState.current;

  const [showDashboard, setShowDashboard] = useState(saved.showDashboard);

  const [showSkillAssessment, setShowSkillAssessment] = useState(false);

  const [character, setCharacter] = useState(saved.character);

  const [goals, setGoals] = useState(saved.goals);

  const [skills, setSkills] = useState(saved.skills);

  const [assessedSkills, setAssessedSkills] = useState(saved.assessedSkills);

  const [gameStyle, setGameStyle] = useState(saved.gameStyle);

  const [questGeneration, setQuestGeneration] = useState(saved.questGeneration);

  const [quests, setQuests] = useState(saved.quests);

  const [progression, setProgression] = useState(saved.progression);
  const [gameMasterLoading, setGameMasterLoading] = useState(false);
  const [gameMasterError, setGameMasterError] = useState("");
  const [completionFeedback, setCompletionFeedback] = useState(null);

  useEffect(() => {
    if (!completionFeedback) return undefined;
    const timeout = setTimeout(() => setCompletionFeedback(null), 4200);
    return () => clearTimeout(timeout);
  }, [completionFeedback]);

  useEffect(() => {
    persistGameState({
      showDashboard,
      character,
      goals,
      skills,
      assessedSkills,
      gameStyle,
      questGeneration,
      quests,
      progression,
    });
  }, [showDashboard, character, goals, skills, assessedSkills, gameStyle, questGeneration, quests, progression]);

  const completeQuest = (id, actualDurationMinutes) => {

    const selectedQuest = quests.find(
      (quest) => quest.id === id
    );

    if (
      !selectedQuest ||
      selectedQuest.completed || selectedQuest.outcomeStatus
    ) {
      return;
    }

    const actualMinutes = normalizeActualDuration(actualDurationMinutes);
    if (actualDurationMinutes !== undefined && actualDurationMinutes !== "" && actualMinutes === null) return;
    const completedAt = new Date().toISOString();
    const nextProgression = recordQuestCompletion(progression, selectedQuest, completedAt, {
      localDate: localDateKey(new Date(completedAt)),
      ...(actualMinutes !== null ? { actualDurationMinutes: actualMinutes } : {}),
    });
    if (nextProgression === progression) return;
    const feedback = buildCompletionFeedback(progression, nextProgression, selectedQuest);
    setProgression(nextProgression);
    setCompletionFeedback({ ...feedback, id: `${id}-${completedAt}` });

    setQuests((currentQuests) =>
      currentQuests.map((quest) =>
        quest.id === id && !quest.completed && !quest.outcomeStatus
          ? {
              ...quest,
              completed: true,
              outcomeStatus: "completed",
            }
          : quest
      )
    );
  };

  const recordQuestStatus = (id, status, actualDurationMinutes) => {
    const selectedQuest = quests.find((quest) => quest.id === id);
    if (!selectedQuest || selectedQuest.completed || selectedQuest.outcomeStatus) return;
    const actualMinutes = normalizeActualDuration(actualDurationMinutes);
    if (status === "abandoned" && actualDurationMinutes !== undefined
      && actualDurationMinutes !== "" && actualMinutes === null) return;
    const recordedAt = new Date().toISOString();
    setProgression((currentProgress) => recordQuestOutcome(currentProgress, selectedQuest, status, {
      recordedAt,
      localDate: localDateKey(new Date(recordedAt)),
      ...(status === "abandoned" && actualMinutes !== null
        ? { actualDurationMinutes: actualMinutes }
        : {}),
    }));
    setQuests((currentQuests) => currentQuests.map((quest) => quest.id === id && !quest.completed && !quest.outcomeStatus
      ? { ...quest, outcomeStatus: status }
      : quest));
  };

  const restartCharacter = () => {

    const nextGeneration = questGeneration + 1;

    setShowDashboard(false);

    setProgression((currentProgress) =>
      createInitialProgression(currentProgress.weeklyBoss)
    );

    setQuestGeneration(nextGeneration);
    setQuests(generateDailyQuests({
      goals,
      skills,
      assessedSkills,
      generation: nextGeneration,
    }));
  };

  const regenerateQuests = async () => {
    if (gameMasterLoading) return;
    const nextGeneration = questGeneration + 1;
    setGameMasterLoading(true);
    setGameMasterError("");
    try {
      const result = await generateQuestSetWithFallback({
        requestAI: () => requestGameMasterQuests({
          character,
          goals,
          skills,
          assessedSkills,
          progression: {
            level: progression.level,
            xp: progression.xp,
            totalXpEarned: progression.totalXpEarned,
            skillPracticeXp: progression.skillPracticeXp,
          },
          history: progression.history.slice(0, 10),
          activityLog: progression.activityRecords.slice(-20),
          weeklyBoss: progression.weeklyBoss,
          currentQuests: quests,
          availableTimeMinutes: DEFAULT_AVAILABLE_TIME_MINUTES,
        }, nextGeneration),
        generateLocal: () => generateDailyQuests({
          goals,
          skills,
          assessedSkills,
          generation: nextGeneration,
        }),
        currentQuests: quests,
      });
      if (result.source !== "existing") {
        setQuestGeneration(nextGeneration);
        setQuests(result.quests);
      }
      setGameMasterError(result.error);
    } finally {
      setGameMasterLoading(false);
    }
  };

  const saveAssessmentScores = (results) => {
    setSkills((currentSkills) => ({
      ...currentSkills,
      ...Object.fromEntries(
        Object.entries(results).map(([skill, result]) => [skill, result.score])
      ),
    }));
    setAssessedSkills((currentSkills) => [
      ...new Set([...currentSkills, ...Object.keys(results)]),
    ]);
  };

  if (showSkillAssessment) {
    return (
      <SkillAssessment
        onComplete={saveAssessmentScores}
        onReturn={() => setShowSkillAssessment(false)}
      />
    );
  }

  if (showDashboard) {

    return (
      <Dashboard
        character={character}
        gameStyle={gameStyle}
        level={progression.level}
        xp={progression.xp}
        progression={progression}
        completionFeedback={completionFeedback}
        quests={quests}
        skills={skills}
        assessedSkills={assessedSkills}
        goals={goals}
        onGoalsChange={setGoals}
        defaultSkills={defaultSkills}
        onCompleteQuest={completeQuest}
        onRecordQuestStatus={recordQuestStatus}
        onRestart={restartCharacter}
        onAssessSkills={() => setShowSkillAssessment(true)}
        onGenerateQuests={regenerateQuests}
        gameMasterLoading={gameMasterLoading}
        gameMasterError={gameMasterError}
      />
    );
  }

  return (
    <CharacterCreation
      character={character}
      onCharacterChange={setCharacter}
      onEnter={() => setShowDashboard(true)}
    />
  );
}

export default App;
