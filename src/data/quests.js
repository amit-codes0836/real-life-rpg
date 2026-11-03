const templatesFor = (skill, goalKeywords, actions) =>
  actions.map(([id, title, difficulty, reason]) => ({
    id,
    title,
    category: skill,
    skill,
    difficulty,
    goalKeywords,
    reason,
  }));

export const questTemplates = [
  ...templatesFor("Coding", ["coding", "programming", "software", "app", "website", "javascript", "python", "web development"], [
    ["coding-review", "Review one concept and write a tiny example", "EASY", "Build coding fluency with a focused practice session."],
    ["coding-feature", "Build or improve one small feature", "MEDIUM", "Practice turning an idea into working code."],
    ["coding-refactor", "Refactor a small piece of code and explain the change", "HARD", "Strengthen code quality and explain your engineering choices."],
  ]),
  ...templatesFor("DSA", ["dsa", "algorithm", "data structure", "coding interview", "leetcode", "problem solving"], [
    ["dsa-review", "Review one data structure and its use cases", "EASY", "Keep core data-structure knowledge fresh."],
    ["dsa-practice", "Solve one DSA problem and explain your approach", "MEDIUM", "Build problem-solving practice with a clear explanation."],
    ["dsa-compare", "Solve a DSA problem and compare two approaches", "HARD", "Practice reasoning about correctness and efficiency."],
  ]),
  ...templatesFor("Backend", ["backend", "api", "server", "database", "web service", "authentication"], [
    ["backend-read", "Trace one API request from route to response", "EASY", "Review how a backend request moves through an application."],
    ["backend-endpoint", "Add or sketch one API endpoint with input validation", "MEDIUM", "Practice a small, safe piece of backend design."],
    ["backend-data", "Design a data flow for one feature, including failure cases", "HARD", "Think through system boundaries and failure handling."],
  ]),
  ...templatesFor("AI / ML", ["ai", "ml", "machine learning", "machine learning model", "data science", "artificial intelligence"], [
    ["ml-review", "Review one ML concept and write a plain-language summary", "EASY", "Reinforce an ML concept by explaining it simply."],
    ["ml-experiment", "Run or outline a small model experiment", "MEDIUM", "Connect ML theory to an observable experiment."],
    ["ml-evaluate", "Compare model results and identify one source of error", "HARD", "Practice evaluating model behavior and limitations."],
  ]),
  ...templatesFor("English", ["english", "writing", "vocabulary", "grammar", "language", "reading comprehension"], [
    ["english-read", "Read a short article and note three useful phrases", "EASY", "Grow reading fluency and practical vocabulary."],
    ["english-write", "Write a short paragraph and edit it for clarity", "MEDIUM", "Practice clear written communication."],
    ["english-present", "Explain an idea aloud for five minutes and refine it", "HARD", "Build confidence expressing a complete idea in English."],
  ]),
  ...templatesFor("Communication", ["communication", "speaking", "conversation", "presentation", "interview", "listening"], [
    ["communication-listen", "Practice active listening in one conversation", "EASY", "Build attention and understanding in a real interaction."],
    ["communication-explain", "Explain a topic clearly to another person", "MEDIUM", "Practice structuring an explanation for a listener."],
    ["communication-present", "Prepare and deliver a short presentation", "HARD", "Build confidence and clarity in a longer explanation."],
  ]),
  ...templatesFor("Fitness", ["fitness", "run", "walk", "exercise", "workout", "health", "strength"], [
    ["fitness-move", "Take a brisk 20-minute walk", "EASY", "Add a manageable movement session to your day."],
    ["fitness-workout", "Complete a 30-minute workout suited to your level", "MEDIUM", "Build consistency with a focused workout."],
    ["fitness-plan", "Complete a challenging workout and record how it felt", "HARD", "Practice effort and recovery awareness at your own level."],
  ]),
  ...templatesFor("Business", ["business", "customer", "marketing", "sales", "startup", "finance", "entrepreneur"], [
    ["business-observe", "Identify one customer problem and who experiences it", "EASY", "Practice noticing a concrete business need."],
    ["business-test", "Draft a simple value proposition for one idea", "MEDIUM", "Turn an idea into a clear customer benefit."],
    ["business-validate", "Design a small test to validate a business assumption", "HARD", "Practice reducing uncertainty with a focused experiment."],
  ]),
  ...templatesFor("Creativity", ["creative", "creativity", "design", "draw", "music", "story", "art"], [
    ["creative-ideas", "Write down five ideas without judging them", "EASY", "Make space for idea generation without evaluation."],
    ["creative-make", "Create a small draft, sketch, or prototype", "MEDIUM", "Move one idea into a tangible first version."],
    ["creative-iterate", "Make two different versions of one creative idea", "HARD", "Explore alternatives before settling on a direction."],
  ]),
  ...templatesFor("Discipline", ["discipline", "habit", "routine", "focus", "consistent", "organize", "time management"], [
    ["discipline-plan", "Choose one priority and schedule a focused 20-minute block", "EASY", "Turn an intention into a specific next action."],
    ["discipline-focus", "Complete one focused work block with notifications off", "MEDIUM", "Practice protecting attention for a meaningful task."],
    ["discipline-finish", "Finish one avoided task and note what helped you start", "HARD", "Build follow-through and learn from your starting friction."],
  ]),
];
