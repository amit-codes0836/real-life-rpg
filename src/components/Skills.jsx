function Skills({ skills, defaultSkills, assessedSkills = [], practiceXp = {} }) {
  return (
    <section className="dashboard-section">

      <div className="section-heading">
        <div>
          <div className="eyebrow">
            CHARACTER
          </div>

          <h2>SKILLS</h2>
          {assessedSkills.length > 0 && (
            <p className="skills-assessment-note">
              Assessed values are preliminary quiz estimates.
            </p>
          )}
        </div>
      </div>

      <div className="dashboard-skills">

        {defaultSkills.map((skill) => (
          <div
            className="dashboard-skill"
            key={skill}
          >

            <div className="skill-name">
              <span>{skill}</span>

              <span className="skill-values">
                <strong>{skills[skill] ?? "—"}</strong>
                <small>{practiceXp[skill] || 0} practice XP</small>
              </span>
            </div>

            {assessedSkills.includes(skill) && (
              <span className="skill-assessed-label">QUIZ ESTIMATE</span>
            )}

            <div className="mini-bar">
              <div
                className="mini-fill"
                style={{
                  width: `${Math.max(0, Math.min(100, Number(skills[skill]) || 0))}%`,
                }}
              />
            </div>

          </div>
        ))}

      </div>

    </section>
  );
}

export default Skills;
