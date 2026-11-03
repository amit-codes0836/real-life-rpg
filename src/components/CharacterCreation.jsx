const avatars = ["🦁", "🧙", "🦸", "🧝", "🥷", "🧑‍🚀", "🧛", "🧟"];

function CharacterCreation({ character, onCharacterChange, onEnter }) {
  const nameIsValid = character.name.trim().length > 0;

  const updateCharacter = (updates) => {
    onCharacterChange((currentCharacter) => ({
      ...currentCharacter,
      ...updates,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!nameIsValid) {
      return;
    }

    updateCharacter({ name: character.name.trim() });
    onEnter();
  };

  return (
    <div className="app">
      <div className="background-glow glow-one" />
      <div className="background-glow glow-two" />

      <header className="topbar">
        <div className="logo">
          <span>⚔</span>
          REAL-LIFE RPG
        </div>
        <div className="progress-text">YOUR JOURNEY STARTS HERE</div>
      </header>

      <main className="container screen">
        <div className="eyebrow">BUILD YOUR CHARACTER</div>
        <h1>
          YOUR LIFE.<br />
          <span>YOUR QUEST.</span>
        </h1>
        <p className="sub">
          Choose how you appear in your world. Every real-life win earns experience.
        </p>

        <form className="card form-card" onSubmit={handleSubmit}>
          <label htmlFor="character-name">PLAYER NAME</label>
          <input
            id="character-name"
            type="text"
            value={character.name}
            onChange={(event) => updateCharacter({ name: event.target.value })}
            placeholder="What should we call you?"
            maxLength={32}
            autoComplete="nickname"
            required
            aria-describedby="character-name-hint"
          />

          <label>CHOOSE YOUR AVATAR</label>
          <div className="avatar-grid" role="group" aria-label="Choose your avatar">
            {avatars.map((avatar) => (
              <button
                className={`avatar${character.avatar === avatar ? " selected" : ""}`}
                type="button"
                key={avatar}
                onClick={() => updateCharacter({ avatar })}
                aria-label={`Choose ${avatar} avatar`}
                aria-pressed={character.avatar === avatar}
              >
                {avatar}
              </button>
            ))}
          </div>

          <button className="primary-button" type="submit" disabled={!nameIsValid}>
            ENTER WORLD ⚔
          </button>
          <p className="hint" id="character-name-hint">
            Your name is required. You can begin with the default avatar or choose another one.
          </p>
        </form>
      </main>
    </div>
  );
}

export default CharacterCreation;
