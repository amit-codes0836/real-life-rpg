# REAL-LIFE RPG

REAL-LIFE RPG turns real-world goals into an RPG-style experience. Create a character, track goals and skills, complete quests, earn XP, level up, practice skills, challenge the weekly boss, and review activity and streaks. The Game Master can suggest personalized quests with Gemini; deterministic local quest generation remains available as a fallback.

Player progress is stored in the browser's `localStorage`. The application does not require a database or account service.

## Tech stack

- React and Vite frontend
- Express backend
- Google Gemini through the backend Game Master integration
- Browser `localStorage` for player saves
- Node.js built-in test runner for backend and frontend/game tests

## Prerequisites

- Node.js 20.19+ or 22.12+
- npm
- A Gemini API key for AI quest generation. Local deterministic quest generation can be used without configuring Gemini.

## Install dependencies

From the project root, install frontend and backend dependencies:

```sh
npm ci
npm ci --prefix backend
```

## Configure the backend

Copy the example environment file and add your Gemini API key to the local backend environment file:

```sh
cp backend/.env.example backend/.env
```

Edit `backend/.env` and replace the placeholder value for `GEMINI_API_KEY` with your key. Keep `backend/.env` private; it is excluded by `.gitignore`. The key is read by the backend and is not a frontend setting.

## Start the application

Run each service in a separate terminal from the project root.

Terminal 1 — backend:

```sh
npm run dev --prefix backend
```

The backend listens on `http://127.0.0.1:3001`. Its health endpoint is `http://127.0.0.1:3001/api/health`.

Terminal 2 — frontend:

```sh
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). Vite proxies `/api` requests to the local backend.

## Tests and production build

Run backend tests:

```sh
npm test --prefix backend
```

Run frontend and game tests:

```sh
node --test src/game/*.test.js src/components/*.test.js
```

Build the production frontend bundle:

```sh
npm run build
```

The generated frontend files are written to `dist/`, which is excluded from Git.
