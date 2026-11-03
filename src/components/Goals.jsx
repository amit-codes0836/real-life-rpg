import { useState } from "react";

export function addGoalToList(goals, draftGoal) {
  const existingGoals = Array.isArray(goals) ? goals : [];
  const nextGoal = typeof draftGoal === "string" ? draftGoal.trim() : "";

  if (!nextGoal) return { added: false, goals: existingGoals, error: "" };

  const normalizedGoal = nextGoal.toLowerCase();
  const isDuplicate = existingGoals.some((goal) =>
    typeof goal === "string" && goal.trim().toLowerCase() === normalizedGoal
  );

  if (isDuplicate) {
    return {
      added: false,
      goals: existingGoals,
      error: "That goal is already on your list. Try a different goal.",
    };
  }

  return { added: true, goals: [...existingGoals, nextGoal], error: "" };
}

function Goals({ goals, onGoalsChange }) {
  const [draftGoal, setDraftGoal] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const activeGoals = goals.filter(
    (goal) => goal.trim() !== ""
  );

  const addGoal = (event) => {
    event.preventDefault();
    const result = addGoalToList(goals, draftGoal);
    setValidationMessage(result.error);
    if (!result.added) return;

    onGoalsChange(result.goals);
    setDraftGoal("");
  };

  return (
    <section className="dashboard-section">

      <div className="section-heading">

        <div>
          <div className="eyebrow">
            MISSION
          </div>

          <h2>
            YOUR GOALS
          </h2>
        </div>

      </div>

      <div className="goals-dashboard">

        {activeGoals.map((goal, index) => (

          <div
            className="goal-item"
            key={index}
          >

            <span>
              {index + 1}
            </span>

            <p>
              {goal}
            </p>

            <button
              className="goal-remove"
              type="button"
              onClick={() => onGoalsChange(activeGoals.filter((_, goalIndex) => goalIndex !== index))}
              aria-label={`Remove goal: ${goal}`}
            >
              ×
            </button>

          </div>

        ))}

        {activeGoals.length === 0 && (
          <p className="empty-text">
            Add a goal to help shape your daily quests.
          </p>
        )}

      </div>

      <form className="goal-entry" onSubmit={addGoal}>
        <label className="visually-hidden" htmlFor="new-goal">Add a personal goal</label>
        <input
          id="new-goal"
          type="text"
          value={draftGoal}
          onChange={(event) => {
            setDraftGoal(event.target.value);
            if (validationMessage) setValidationMessage("");
          }}
          placeholder="Add a goal to work toward…"
          maxLength={100}
        />
        <button className="secondary-button" type="submit" disabled={!draftGoal.trim()}>
          ADD GOAL
        </button>
      </form>

      {validationMessage && <p className="goal-validation-message" role="alert">{validationMessage}</p>}

    </section>
  );
}

export default Goals;
