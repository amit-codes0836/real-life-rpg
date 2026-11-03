import { useState } from "react";
import { assessmentQuestions, assessmentSkills } from "../data/assessmentQuestions";

const questions = assessmentSkills.flatMap((skill) =>
  assessmentQuestions[skill].map((question, index) => ({
    ...question,
    skill,
    id: `${skill}-${index}`,
  }))
);

function SkillAssessment({ onComplete, onReturn }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  const currentQuestion = questions[currentIndex];
  const selectedAnswer = answers[currentQuestion.id];
  const correctCount = (skill) =>
    assessmentQuestions[skill].reduce(
      (count, question, index) =>
        count + (answers[`${skill}-${index}`] === question.answer ? 1 : 0),
      0
    );

  const results = assessmentSkills.map((skill) => {
    const correct = correctCount(skill);
    const incorrectTopics = assessmentQuestions[skill]
      .filter((question, index) => answers[`${skill}-${index}`] !== question.answer)
      .map((question) => question.topic);

    return {
      skill,
      correct,
      total: assessmentQuestions[skill].length,
      score: Math.round((correct / assessmentQuestions[skill].length) * 100),
      topicsToReview: [...new Set(incorrectTopics)],
    };
  });

  const chooseAnswer = (optionIndex) => {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [currentQuestion.id]: optionIndex,
    }));
  };

  const finishAssessment = () => {
    if (selectedAnswer === undefined) return;

    const scoreMap = Object.fromEntries(
      results.map(({ skill, score, correct, total, topicsToReview }) => [skill, {
        score,
        correct,
        total,
        topicsToReview,
      }])
    );
    onComplete(scoreMap);
    setShowResults(true);
  };

  if (showResults) {
    return (
      <div className="app assessment-app">
        <div className="background-glow glow-one" />
        <div className="background-glow glow-two" />
        <header className="topbar">
          <div className="logo"><span>⚔</span>REAL-LIFE RPG</div>
          <div className="progress-text">ASSESSMENT RESULTS</div>
        </header>
        <main className="container screen assessment-screen">
          <div className="eyebrow">YOUR STARTING POINT</div>
          <h1>SKILL <span>ESTIMATES.</span></h1>
          <p className="sub">
            Each score is the percentage of correct answers in a five-question quiz. These are preliminary estimates, not proof of real-world ability.
          </p>

          <section className="assessment-results" aria-label="Skill assessment results">
            {results.map((result) => (
              <article className="assessment-result" key={result.skill}>
                <div className="assessment-result-heading">
                  <h2>{result.skill}</h2>
                  <strong>{result.score}<span>/100</span></strong>
                </div>
                <div className="mini-bar" aria-label={`${result.score} out of 100 estimated score`}>
                  <div className="mini-fill" style={{ width: `${result.score}%` }} />
                </div>
                <p className="assessment-result-count">
                  {result.correct} of {result.total} correct ({result.score}% correct)
                </p>
                <p className="assessment-result-note">
                  {result.score === 100
                    ? "Strong result across the topics in this short quiz."
                    : result.score >= 60
                      ? `Good starting knowledge. Review: ${result.topicsToReview.join(", ")}.`
                      : `Use these topics as a learning roadmap: ${result.topicsToReview.join(", ")}.`}
                </p>
              </article>
            ))}
          </section>

          <button className="primary-button assessment-return" onClick={onReturn}>
            RETURN TO DASHBOARD
          </button>
        </main>
      </div>
    );
  }

  const isLastQuestion = currentIndex === questions.length - 1;
  const progress = currentIndex + 1;

  return (
    <div className="app assessment-app">
      <div className="background-glow glow-one" />
      <div className="background-glow glow-two" />
      <header className="topbar">
        <div className="logo"><span>⚔</span>REAL-LIFE RPG</div>
        <div className="progress-text">SKILL ASSESSMENT</div>
      </header>

      <main className="container screen assessment-screen">
        <div className="eyebrow">A QUICK KNOWLEDGE CHECK</div>
        <h1>ASSESS <span>SKILLS.</span></h1>
        <p className="sub">
          Answer 25 questions across five skills. This short quiz gives preliminary estimates, not a complete measure of real-world ability.
        </p>

        <section className="card assessment-card" aria-labelledby="assessment-question">
          <div className="assessment-progress-row">
            <span>{currentQuestion.skill} · {currentQuestion.topic}</span>
            <strong>QUESTION {currentIndex + 1} / {questions.length}</strong>
          </div>
          <div
            className="assessment-progress-track"
            role="progressbar"
            aria-label="Assessment progress"
            aria-valuemin={0}
            aria-valuemax={questions.length}
            aria-valuenow={progress}
          >
            <div className="assessment-progress-fill" style={{ width: `${(progress / questions.length) * 100}%` }} />
          </div>

          <fieldset className="assessment-fieldset">
            <legend id="assessment-question">{currentQuestion.prompt}</legend>
            <div className="assessment-options">
              {currentQuestion.options.map((option, index) => (
                <label className={`assessment-option${selectedAnswer === index ? " selected" : ""}`} key={option}>
                  <input
                    type="radio"
                    name={currentQuestion.id}
                    value={index}
                    checked={selectedAnswer === index}
                    onChange={() => chooseAnswer(index)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {selectedAnswer !== undefined && (
            <p className={`assessment-explanation${selectedAnswer === currentQuestion.answer ? " correct" : " incorrect"}`} aria-live="polite">
              <strong>{selectedAnswer === currentQuestion.answer ? "Correct. " : "Not quite. "}</strong>
              {currentQuestion.explanation}
            </p>
          )}

          <div className="assessment-navigation">
            <button
              className="back-button"
              type="button"
              onClick={() => setCurrentIndex((index) => index - 1)}
              disabled={currentIndex === 0}
            >
              ← PREVIOUS
            </button>
            {isLastQuestion ? (
              <button className="primary-button" type="button" onClick={finishAssessment} disabled={selectedAnswer === undefined}>
                SEE RESULTS
              </button>
            ) : (
              <button className="primary-button" type="button" onClick={() => setCurrentIndex((index) => index + 1)} disabled={selectedAnswer === undefined}>
                NEXT QUESTION →
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default SkillAssessment;
