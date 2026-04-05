/**
 * validateQuestion.ts
 * Programmatic difficulty enforcement — Gemini cannot be trusted to self-enforce.
 * These checks run after every generated question and can force a retry.
 */

const BANNED_TOPICS = [
  'jackie robinson color barrier',
  'babe ruth home runs career',
  'how many world series',
  'what team did',
  'who is considered',
  'hall of fame',
  'nicknamed',
  'born in',
  'died in',
  'first black player',
  'broke the color',
  'how many seasons',
  'what year did babe',
  'how many home runs did babe',
  'who won the world series in 19',
  'what sport did',
  'how many players',
  'what does era stand for',
  'what does war stand for',
];

/**
 * Returns true if the question is too easy / hits a banned topic.
 * Used to reject generated questions and force a retry.
 */
export function isQuestionTooEasy(question: string): boolean {
  const lower = question.toLowerCase();

  // Reject any banned topic
  for (const banned of BANNED_TOPICS) {
    if (lower.includes(banned)) return true;
  }

  // Too short = too simple
  if (question.length < 60) return true;

  return false;
}

/**
 * Returns true if the question passes validation for the given difficulty.
 * Non-hard questions always pass — only hard questions are gated.
 */
export function validateHardQuestion(question: string, difficulty: string): boolean {
  if (difficulty !== 'hard') return true;
  if (isQuestionTooEasy(question)) return false;
  return true;
}
