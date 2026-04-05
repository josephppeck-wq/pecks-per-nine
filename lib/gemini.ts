import { GoogleGenerativeAI } from '@google/generative-ai';

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
 - Example: 'True or False: Mike Trout's peak 3-year WAR from 2012-2014 exceeded Barry Bonds' peak 3-year WAR from 2001-2003'
 - Never use obvious true/false that any fan would know

For type-in at hard difficulty:
 - Ask for specific numbers, years, or names that require genuine recall
 - Example: 'To the nearest 10 points, what was Ted Williams' OPS+ in his final full season?'
 - Accept answers within reasonable range for numeric answers

NEVER generate questions about:
 - Basic Hall of Fame membership
 - Obvious nicknames (The Sultan of Swat, etc.)
 - Questions answerable with zero baseball knowledge`;

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

  const userPrompt = `Generate a baseball trivia question.
${difficulty ? `Difficulty: ${difficulty}` : 'Random difficulty'}
${category ? `Category: ${category}` : ''}
${era ? `Era: ${era}` : ''}
${questionType ? `Type: ${questionType}` : 'Any type'}${exclusionNote}

Return only valid JSON, no markdown.`;

  try {
    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: userPrompt },
    ]);
    const text = result.response.text().trim();
    const cleaned = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(cleaned);
    return { id: crypto.randomUUID(), ...parsed };
  } catch {
    // Retry once
    try {
      const result = await model.generateContent([
        { text: SYSTEM_PROMPT },
        { text: userPrompt + '\n\nReturn ONLY valid JSON, absolutely no other text.' },
      ]);
      const text = result.response.text().trim();
      const cleaned = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(cleaned);
      return { id: crypto.randomUUID(), ...parsed };
    } catch {
      return getFallbackQuestion(difficulty);
    }
  }
}

export async function generateDailyQuestion(
  era: string,
  difficulty: 'medium' | 'hard'
): Promise<Question> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  let eraContext: string;
  if (era === 'Pirates-birthday') {
    eraContext =
      'Pittsburgh Pirates baseball with a birthday celebration angle. Focus on Pirates history, legendary Pirates players, memorable Pirates moments, and their storied franchise.';
  } else if (era === 'Sabermetrics') {
    eraContext =
      'advanced baseball statistics including WAR, OPS+, FIP, WHIP, xFIP, wRC+, BABIP, and other sabermetric concepts. Test knowledge of these metrics and the players who excelled by these measures.';
  } else if (era === 'Deadball') {
    eraContext =
      'the Deadball Era of baseball (approximately 1900–1919), including its players, pitching-dominated strategies, rules, and historic events.';
  } else if (era === 'Classic') {
    eraContext =
      'the Classic Era of baseball (1920s–1960s), including the golden age of the sport, legendary players, and historic moments.';
  } else if (era === 'Modern') {
    eraContext =
      'the Modern Era of baseball (1970s–present), including contemporary players, records, and events.';
  } else if (era === 'Pirates-focused') {
    eraContext =
      'the Pittsburgh Pirates franchise, including their history, players, World Series appearances, and iconic moments at Forbes Field and PNC Park.';
  } else {
    eraContext = `baseball history related to the ${era} era.`;
  }

  const obscurityInstruction = `
The daily question is the featured question of the day for a sabermetrics club. It must meet ALL of these criteria:

1. OBSCURE: The answer should not be immediately obvious to even knowledgeable fans. It should require genuine recall or reasoning from statistical knowledge.

2. SPECIFIC: Ask about a specific number, year, player, or record — not a general concept.

3. DEBATABLE: Ideally the question should be one where members of a sabermetrics club would argue about the answer before submitting. The kind of question that makes someone say 'wait, was it him or was it...'

4. FACTUALLY PERFECT: The answer must be 100% verifiable and correct. Never generate a daily question where the answer could be disputed. Double-check all stats and records before generating.

5. FORMAT VARIETY: Rotate through formats day by day:
 Monday: Advanced stat record (WAR, OPS+, ERA+, FIP)
 Tuesday: Obscure World Series or postseason fact
 Wednesday: Specific franchise record (any team)
 Thursday: Historical stat line or season record
 Friday: Pirates-specific obscure fact or record
 Saturday: Multi-part list question (name X players)
 Sunday: True/False with a surprising correct answer

EXAMPLE daily questions at the correct difficulty level:
 - 'Which player holds the record for highest single-season WAR by a catcher since 1950 and what was it?'
 - 'Name the only pitcher since integration to win back-to-back Cy Young awards in both leagues'
 - 'What is the lowest team batting average to win a World Series since 1970?'
 - 'Which Pirate holds the franchise record for career WAR among pitchers who spent at least 5 seasons in Pittsburgh?'
 - 'True or False: The 1906 Chicago Cubs had a better Pythagorean win expectation than their actual record'

Never generate a daily question that a casual fan could answer without significant baseball knowledge.`;

  const userPrompt = `Generate a baseball trivia question about ${eraContext}
Difficulty: ${difficulty}${obscurityInstruction}

Return only valid JSON, no markdown.`;

  try {
    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: userPrompt },
    ]);
    const text = result.response.text().trim();
    const cleaned = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(cleaned);
    return { id: crypto.randomUUID(), ...parsed };
  } catch {
    // Retry once with stronger JSON-only instruction
    try {
      const result = await model.generateContent([
        { text: SYSTEM_PROMPT },
        {
          text:
            userPrompt +
            '\n\nReturn ONLY valid JSON. No markdown, no code fences, no explanation. Just the raw JSON object.',
        },
      ]);
      const text = result.response.text().trim();
      const cleaned = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(cleaned);
      return { id: crypto.randomUUID(), ...parsed };
    } catch {
      return generateQuestion(difficulty);
    }
  }
}

function getFallbackQuestion(difficulty?: 'easy' | 'medium' | 'hard'): Question {
  const questions: Question[] = [
    {
      id: crypto.randomUUID(),
      text: 'Who holds the record for the most career home runs in MLB history?',
      type: 'multiple_choice',
      difficulty: 'easy',
      options: ['Babe Ruth', 'Barry Bonds', 'Hank Aaron', 'Willie Mays'],
      correct_answer: 'Barry Bonds',
      explanation: "Barry Bonds hit 762 career home runs, surpassing Hank Aaron's record of 755.",
      category: 'records',
    },
    {
      id: crypto.randomUUID(),
      text: "In what year did Jackie Robinson break baseball's color barrier?",
      type: 'type_in',
      difficulty: 'medium',
      correct_answer: '1947',
      explanation: 'Jackie Robinson debuted with the Brooklyn Dodgers on April 15, 1947.',
      category: 'history',
    },
    {
      id: crypto.randomUUID(),
      text: 'Babe Ruth played his entire career with the New York Yankees.',
      type: 'true_false',
      difficulty: 'easy',
      correct_answer: 'False',
      explanation:
        'Ruth started his career with the Boston Red Sox before being sold to the Yankees in 1920.',
      category: 'players',
    },
  ];
  const filtered = difficulty ? questions.filter((q) => q.difficulty === difficulty) : questions;
  const pool = filtered.length > 0 ? filtered : questions;
  return pool[Math.floor(Math.random() * pool.length)];
}
