import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let vite;
let QuestCard;

before(async () => {
  vite = await createServer({
    configFile: resolve(process.cwd(), "vite.config.js"),
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  ({ default: QuestCard } = await vite.ssrLoadModule("/src/components/QuestCard.jsx"));
});

after(async () => {
  await vite?.close();
});

const renderQuest = (quest) => renderToStaticMarkup(React.createElement(QuestCard, {
  quest,
  onComplete: () => {},
}));

const localQuest = {
  id: "local-quest-1",
  title: "Review one API route",
  category: "Backend",
  difficulty: "EASY",
  xp: 25,
  completed: false,
  reason: "Practice one small backend concept.",
};

test("renders extended AI quest details as a readable mission", () => {
  const html = renderQuest({
    ...localQuest,
    estimatedDurationMinutes: 12,
    objective: "Build a small endpoint and verify its response.",
    instructions: ["Choose one simple resource.", "Run a request and inspect the response."],
    successCriteria: ["Return 1 successful response from the local request."],
    skillImpact: {
      skill: "Backend",
      impact: "practice",
      explanation: "Practice route design and request handling.",
    },
  });

  for (const text of [
    "Review one API route", "Backend", "EASY", "12 min", "Objective",
    "Build a small endpoint and verify its response.", "Mission steps",
    "Choose one simple resource.", "Run a request and inspect the response.",
    "Success criteria", "Return 1 successful response from the local request.",
    "Skill impact", "practice", "Practice route design and request handling.",
  ]) {
    assert.ok(html.includes(text), `expected rendered quest to include: ${text}`);
  }
  assert.ok(html.includes("Required mission"));
  assert.ok(html.includes("+25 XP"));
});

test("legacy quests with missing extended fields render without placeholders or errors", () => {
  const html = renderQuest(localQuest);

  for (const text of ["Review one API route", "Backend", "EASY", "Required mission", "+25 XP"]) {
    assert.ok(html.includes(text));
  }
  for (const text of ["Objective", "Mission steps", "Success criteria", "Skill impact", "undefined", "null"]) {
    assert.equal(html.includes(text), false);
  }
});

test("required missions and optional challenges have distinct status labels", () => {
  const requiredHtml = renderQuest({ ...localQuest, optionalLongerChallenge: false });
  const optionalHtml = renderQuest({ ...localQuest, optionalLongerChallenge: true });

  assert.ok(requiredHtml.includes('class="quest-status required">Required mission</span>'));
  assert.ok(optionalHtml.includes('class="quest-status optional">Optional challenge</span>'));
  assert.ok(optionalHtml.includes("quest-optional"));
});

test("pending quests expose terminal outcome and optional actual-time controls", () => {
  const pending = renderQuest({ ...localQuest, estimatedDurationMinutes: 12 });
  assert.ok(pending.includes("pending"));
  assert.ok(pending.includes('type="number" min="1" max="1440"'));
  assert.ok(pending.includes("Mark missed"));
  assert.ok(pending.includes("Abandon"));
  assert.ok(pending.includes("12 min"));

  const abandoned = renderQuest({ ...localQuest, outcomeStatus: "abandoned" });
  assert.ok(abandoned.includes('class="quest-outcome-status abandoned">abandoned</span>'));
  assert.equal(abandoned.includes("Mark missed"), false);
  assert.equal(abandoned.includes("Abandon"), false);
});

test("quest completion control still reports the quest ID and disables completed quests", () => {
  let completedId = null;
  const tree = QuestCard({ quest: localQuest, onComplete: (id) => { completedId = id; } });
  const button = React.Children.toArray(tree.props.children)
    .find((child) => child?.props?.className === "quest-check");

  button.props.onClick();
  assert.equal(completedId, localQuest.id);

  const completedTree = QuestCard({
    quest: { ...localQuest, completed: true },
    onComplete: () => assert.fail("completed quest should not be activated"),
  });
  const completedButton = React.Children.toArray(completedTree.props.children)
    .find((child) => child?.props?.className === "quest-check");
  assert.equal(completedButton.props.disabled, true);
});

test("quest detail layout wraps for narrow screens", async () => {
  const css = await readFile(resolve(process.cwd(), "src/style.css"), "utf8");
  const mobileRules = css.match(/@media \(max-width: 700px\)[\s\S]*$/)?.[0] || "";

  assert.match(mobileRules, /\.quest-heading\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(mobileRules, /\.quest-detail\s*\{[^}]*padding:/s);
});

test("gameplay motion is reduced on request and outcome buttons remain touch sized", async () => {
  const css = await readFile(resolve(process.cwd(), "src/style.css"), "utf8");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.01ms/s);
  assert.match(css, /\.quest-outcome-button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.quest-check\s*\{\s*width:\s*44px;\s*height:\s*44px;/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.level-box\s*\{/s);
});
