import { GoogleGenerativeAI } from '@google/generative-ai';
import { isQuestionTooEasy } from '@/lib/validateQuestion';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface Question {
  id: string;
  text: string;
  type: 'multiple_choice' | 'true_false' | 'type_in' | 'list_entry';
  difficulty: 'easy' | 'medium' | 'hard';
  options?: string[];
  correct_answer: string | string[];
  explanation: string;
  era?: string;
  category?: string;
}

// ── Shared system prompt (used by generateQuestion for regular play) ─────────
const SYSTEM_PROMPT = `You are a baseball historian and trivia expert specializing in the history of Major League Baseball from 1900-2000. Generate engaging, genuinely challenging baseball trivia questions.

Return JSON with this exact structure:
{
  "text": "The question text",
  "type": "multiple_choice" | "true_false" | "type_in" | "list_entry",
  "difficulty": "easy" | "medium" | "hard",
  "options": ["A", "B", "C", "D"] (for multiple_choice only),
  "correct_answer": "The answer" (string for single answer, array for list_entry),
  "explanation": "Brief explanation of the answer",
  "era": "1920s" (optional decade/era),
  "category": "records" | "stadiums" | "players" | "teams" | "stats" | "history"
}

DIFFICULTY SETTINGS:
easy (20% of questions):
 - Still challenging — not basic facts
 - Example: 'How many World Series did the Yankees win in the 1990s?' not 'Who was Babe Ruth?'
 - Should stump casual fans occasionally

medium (50% of questions):
 - Genuinely hard — requires deep knowledge
 - Specific stats, specific years, specific records
 - Example: 'Who holds the NL record for RBIs in a single season?' or 'What year did Forbes Field open?'
 - Should stump most fans

HARD DIFFICULTY — SABERMETRICS CLUB STANDARD:
These questions must genuinely challenge people who:
 - Know advanced stats cold (WAR, OPS+, ERA+, FIP, wRC+)
 - Have memorized World Series rosters and stats
 - Can recall specific season stat lines from memory
 - Debate Hall of Fame WAR thresholds for fun

Example hard questions that are ACCEPTABLE:
 - 'Which pitcher led the NL in FIP in 1968 despite not winning the Cy Young?'
 - 'Who holds the record for highest single-season OPS+ with fewer than 400 plate appearances since 1980?'
 - 'Name the only player to steal 40+ bases and hit 40+ home runs in the same season in the AL'
 - 'What was Roberto Clemente's career OPS+?'
 - 'Which team had the highest run differential in MLB history without winning the World Series?'
 - 'Who holds the Pirates franchise record for single season WAR position players?'
 - 'What year did the Cubs have their highest team ERA+ since 1900?'
 - 'Name the only pitcher since 1950 to throw a no-hitter and lose'

Example questions that are NOT ACCEPTABLE for hard:
 - 'How many home runs did Babe Ruth hit?'
 - 'Who won the 1979 World Series?'
 - 'What team did Willie Mays play for?'
 - Any question answerable by a casual fan

For list questions at hard difficulty:
 - 'Name 5 players with a career OPS+ over 160 with at least 5000 plate appearances'
 - 'Name 4 pitchers who won the Cy Young with an ERA+ over 180'
 - 'Name 3 players who had a 10+ WAR season since 2000'

For true/false at hard difficulty:
 - Must involve specific stats or records that require genuine expertise to evaluate
 - Example: 'True or False: Mike Trout's peak 3-year WAR from 2012-2014 exceeded Barry Bonds peak 3-year WAR from 2001-2003'
 - Never use obvious true/false that any fan would know

For type-in at hard difficulty:
 - Ask for specific numbers, years, or names that require genuine recall
 - Example: 'To the nearest 10 points, what was Ted Williams OPS+ in his final full season?'
 - Accept answers within reasonable range for numeric answers

NEVER generate questions about:
 - Basic Hall of Fame membership
 - Obvious nicknames (The Sultan of Swat, etc.)
 - Questions answerable with zero baseball knowledge`;

// ── Helper: call Gemini and parse JSON ───────────────────────────────────────
async function callGemini(
  model: ReturnType<typeof genAI.getGenerativeModel>,
  systemPrompt: string,
  userPrompt: string
): Promise<Record<string, unknown> | null> {
  try {
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt },
    ]);
    const text = result.response.text().trim();
    const cleaned = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ── generateQuestion: regular play, with retry + validation ─────────────────
const MAX_RETRIES = 3;

export async function generateQuestion(
  difficulty?: 'easy' | 'medium' | 'hard',
  category?: string,
  era?: string,
  questionType?: string,
  usedQuestions?: string[]
): Promise<Question> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const exclusionNote =
    usedQuestions && usedQuestions.length > 0
      ? `\nDo NOT generate any of these questions already asked this session:\n${usedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\nGenerate a completely different question.`
      : '';

  const rejectedQuestions: string[] = [];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const rejectionNote =
      rejectedQuestions.length > 0
        ? `\nThe following questions were rejected for being too easy. Do NOT generate similar questions:\n${rejectedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\nGenerate a significantly harder and more obscure question.`
        : '';

    const userPrompt = `Generate a baseball trivia question.
${difficulty ? `Difficulty: ${difficulty}` : 'Random difficulty'}
${category ? `Category: ${category}` : ''}
${era ? `Era: ${era}` : ''}
${questionType ? `Type: ${questionType}` : 'Any type'}${exclusionNote}${rejectionNote}

Return only valid JSON, no markdown.`;

    const parsed = await callGemini(model, SYSTEM_PROMPT, userPrompt);
    if (!parsed) continue;

    const question: Question = { id: crypto.randomUUID(), ...(parsed as Omit<Question, 'id'>) };

    // Validate difficulty — reject and retry if too easy for hard
    if (difficulty === 'hard' && isQuestionTooEasy(question.text)) {
      rejectedQuestions.push(question.text);
      continue;
    }

    return question;
  }

  // All retries exhausted
  return getFallbackQuestion(difficulty);
}

// ── generateDailyQuestion: dedicated system prompt, strict validator ─────────
const DAILY_SYSTEM_PROMPT = `You are generating the daily featured question for a website used by a sabermetrics club. These are expert baseball statisticians who know advanced metrics cold.

Return JSON with this exact structure:
{
  "text": "The question text",
  "type": "multiple_choice" | "true_false" | "type_in" | "list_entry",
  "difficulty": "hard",
  "options": ["A", "B", "C", "D"] (for multiple_choice only),
  "correct_answer": "The answer" (string for single answer, array for list_entry),
  "explanation": "Brief explanation of the answer",
  "era": "optional era string",
  "category": "records" | "stadiums" | "players" | "teams" | "stats" | "history"
}

STRICT REQUIREMENTS:
 - The answer must NOT be Jackie Robinson, Babe Ruth, or any fact known to casual fans
 - The question must involve a specific number, year, stat, or record
 - A casual fan must not be able to answer this
 - The question must be at least 80 characters long
 - Must reference specific statistics, records, or obscure historical facts
 - Difficulty: EXPERT ONLY

GOOD EXAMPLES:
 "Which pitcher led the NL in FIP in 1968 with a mark under 2.00 despite pitching for a losing team?"
 "What is the highest single-season WAR recorded by a Pittsburgh Pirate position player and who recorded it?"
 "Name the only catcher since 1960 to post an OPS+ above 160 in a season with at least 400 plate appearances"
 "True or False: The 1998 Yankees had a higher run differential than the 2001 Mariners despite the Mariners winning more games"

BAD EXAMPLES (NEVER generate these):
 "What year did Jackie Robinson break the color barrier?"
 "How many career home runs did Babe Ruth hit?"
 "Who won the 1927 World Series?"
 "What team did Willie Mays play for?"

Respond in JSON only. No markdown. No backticks.`;

const DAILY_FORMAT_BY_DOW: Record<number, string> = {
  0: 'a true/false question with a surprising or counterintuitive correct answer involving specific stats or records',
  1: 'an advanced stat record question involving WAR, OPS+, ERA+, or FIP — ask for a specific record holder or value',
  2: 'an obscure World Series or postseason fact — specific game, stat, or achievement most fans would not know',
  3: 'a specific franchise record for any MLB team — most obscure records preferred',
  4: 'a historical stat line or single-season record — ask for a specific number or player',
  5: 'a Pittsburgh Pirates specific obscure fact or record — franchise history, stats, or players',
  6: 'a list question asking players who achieved a rare feat — e.g. "Name 3 players who..."',
};

export async function generateDailyQuestion(
  era: string,
  _difficulty: 'medium' | 'hard', // always overridden to hard
  dayOfWeek?: number
): Promise<Question> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const formatInstruction =
    dayOfWeek !== undefined && DAILY_FORMAT_BY_DOW[dayOfWeek]
      ? `\nToday's format: ${DAILY_FORMAT_BY_DOW[dayOfWeek]}.`
      : '';

  const eraInstruction = era
    ? `\nFocus on: ${getEraContext(era)}`
    : '';

  const rejectedQuestions: string[] = [];
  const DAILY_MAX_RETRIES = 5;

  for (let attempt = 0; attempt < DAILY_MAX_RETRIES; attempt++) {
    const rejectionNote =
      rejectedQuestions.length > 0
        ? `\n\nPREVIOUS ATTEMPTS REJECTED FOR BEING TOO EASY:\n${rejectedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\nGenerate a significantly harder and more obscure question than any of the above.`
        : '';

    const userPrompt = `Generate today's featured daily question.${formatInstruction}${eraInstruction}${rejectionNote}

Return only valid JSON, no markdown, no backticks.`;

    const parsed = await callGemini(model, DAILY_SYSTEM_PROMPT, userPrompt);
    if (!parsed) continue;

    const question: Question = { id: crypto.randomUUID(), ...(parsed as Omit<Question, 'id'>) };

    // Enforce minimum length (80 chars) AND banned-topic check
    if (question.text.length < 80 || isQuestionTooEasy(question.text)) {
      rejectedQuestions.push(question.text);
      continue;
    }

    return question;
  }

  // All retries exhausted — use hardest fallback
  return getFallbackQuestion('hard');
}

// ── Era context helper ───────────────────────────────────────────────────────
function getEraContext(era: string): string {
  switch (era) {
    case 'Pirates-birthday':
      return 'Pittsburgh Pirates baseball with a birthday celebration angle. Focus on Pirates history, legendary Pirates players, memorable Pirates moments, and their storied franchise.';
    case 'Sabermetrics':
      return 'advanced baseball statistics including WAR, OPS+, FIP, WHIP, xFIP, wRC+, BABIP, and other sabermetric concepts. Test knowledge of these metrics and the players who excelled by these measures.';
    case 'Deadball':
      return 'the Deadball Era of baseball (approximately 1900–1919), including its players, pitching-dominated strategies, rules, and historic events.';
    case 'Classic':
      return 'the Classic Era of baseball (1920s–1960s), including the golden age of the sport, legendary players, and historic moments.';
    case 'Modern':
      return 'the Modern Era of baseball (1970s–present), including contemporary players, records, and events.';
    case 'Pirates-focused':
      return 'the Pittsburgh Pirates franchise, including their history, players, World Series appearances, and iconic moments at Forbes Field and PNC Park.';
    default:
      return `baseball history related to the ${era} era.`;
  }
}

// ── Fallback question bank (last resort) ────────────────────────────────────
function getFallbackQuestion(difficulty?: 'easy' | 'medium' | 'hard'): Question {
  const questions: Question[] = [
    {
      id: crypto.randomUUID(),
      text: 'Which player holds the MLB record for highest single-season OPS+ with at least 500 plate appearances, posting a mark of 235 in 2002?',
      type: 'type_in',
      difficulty: 'hard',
      correct_answer: 'Barry Bonds',
      explanation: 'Barry Bonds posted an OPS+ of 235 in 2002, the highest single-season mark in MLB history among qualified hitters.',
      category: 'records',
    },
    {
      id: crypto.randomUUID(),
      text: 'What was the career ERA+ of Bob Gibson, widely regarded as one of the greatest pitchers in National League history?',
      type: 'type_in',
      difficulty: 'hard',
      correct_answer: '127',
      explanation: 'Bob Gibson posted a career ERA+ of 127 over his Hall of Fame career with the St. Louis Cardinals.',
      category: 'stats',
    },
    {
      id: crypto.randomUUID(),
      text: 'True or False: Walter Johnson had a higher career WAR than Cy Young despite winning fewer games.',
      type: 'true_false',
      difficulty: 'hard',
      correct_answer: 'True',
      explanation: "Walter Johnson's career WAR (~164) exceeds Cy Young's (~167) — actually remarkably close, but Johnson's dominance in a shorter career yields similar WAR to Young's longevity.",
      category: 'stats',
    },
    {
      id: crypto.randomUUID(),
      text: 'Which Pittsburgh Pirate holds the franchise single-season record for position player WAR, posting a mark over 10 WAR in 1967?',
      type: 'type_in',
      difficulty: 'hard',
      correct_answer: 'Roberto Clemente',
      explanation: 'Roberto Clemente posted some of the highest WAR seasons in Pirates franchise history, combining elite defense in right field with outstanding hitting.',
      category: 'stats',
    },
  ];

  const filtered = difficulty ? questions.filter((q) => q.difficulty === difficulty) : questions;
  const pool = filtered.length > 0 ? filtered : questions;
  return pool[Math.floor(Math.random() * pool.length)];
}
