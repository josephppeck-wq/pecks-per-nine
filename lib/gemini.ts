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

hard (30% of questions):
 - Expert level — sabermetrics club difficulty
 - Advanced stats, obscure records, rare facts
 - Example: 'Which pitcher had the lowest ERA+ in a Cy Young winning season since 1980?'
 - Should challenge even hardcore historians

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
This is the featured daily question. It must be a genuinely obscure fact that even dedicated fans would find challenging. Ideal daily questions:
- Specific statistical records and the players who hold them
- Obscure World Series or playoff facts
- Rare achievements or unusual records
- Specific dates, numbers, or stats that require deep knowledge
- Pirates-specific obscure facts when era is Pirates-focused or Pirates-birthday
The question should make a sabermetrics club debate the answer before submitting.`;

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
