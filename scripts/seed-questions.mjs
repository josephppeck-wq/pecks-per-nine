#!/usr/bin/env node
/**
 * Peck's Per Nine — Question Bank Seeder
 * Generates 200 hard MLB trivia questions via Gemini and inserts into question_bank.
 *
 * Prerequisites:
 *   1. question_bank table must exist (run supabase/migrations/001_initial_schema.sql first)
 *   2. .env.local must have GEMINI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/seed-questions.mjs
 *
 * All questions are validated with isQuestionTooEasy() before insertion.
 * Any question that fails validation is rejected and regenerated (up to 3 retries).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ──────────────────────────────────────────────────────────
function loadEnv(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv(resolve(__dirname, '../.env.local'));

const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required env vars. Check .env.local');
  process.exit(1);
}

// ── Clients ──────────────────────────────────────────────────────────────────
const genAI    = new GoogleGenerativeAI(GEMINI_API_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const model    = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// ── Validator (mirrors lib/validateQuestion.ts) ───────────────────────────────
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

function isQuestionTooEasy(text) {
  const lower = text.toLowerCase();
  for (const banned of BANNED_TOPICS) {
    if (lower.includes(banned)) return true;
  }
  if (text.length < 60) return true;
  return false;
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are generating questions for a question bank used by a sabermetrics club website. These are expert baseball statisticians.

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

ALL questions must be difficulty: "hard".

HARD DIFFICULTY — SABERMETRICS CLUB STANDARD:
These questions must genuinely challenge people who know WAR, OPS+, ERA+, FIP, wRC+ cold.

ACCEPTABLE examples:
 - "Which pitcher led the NL in FIP in 1968 despite not winning the Cy Young?"
 - "Who holds the record for highest single-season OPS+ with fewer than 400 PA since 1980?"
 - "What was Roberto Clemente's career OPS+?"
 - "Name the only pitcher since 1950 to throw a no-hitter and lose"
 - "Which team had the highest run differential in MLB history without winning the World Series?"
 - "True or False: Mike Trout's peak 3-year WAR from 2012-2014 exceeded Barry Bonds' peak 3-year WAR from 2001-2003"

NOT ACCEPTABLE:
 - "How many home runs did Babe Ruth hit?"
 - "Who won the 1979 World Series?"
 - "What team did Willie Mays play for?"
 - Any question answerable by a casual fan

Question MUST be at least 80 characters long.

Respond in JSON only. No markdown. No backticks.`;

// ── Question plan ─────────────────────────────────────────────────────────────
// 200 total: 50 per question type, spread across eras
// type_in weighted toward specific numbers/stats
const PLAN = [];
const CONFIGS = [
  // [type, era, count]
  ['multiple_choice', 'modern',   20],
  ['multiple_choice', 'classic',  18],
  ['multiple_choice', 'deadball',  8],
  ['multiple_choice', 'founding',  4],
  ['true_false',      'modern',   20],
  ['true_false',      'classic',  18],
  ['true_false',      'deadball',  8],
  ['true_false',      'founding',  4],
  ['type_in',         'modern',   20],
  ['type_in',         'classic',  17],
  ['type_in',         'deadball',  7],
  ['type_in',         'founding',  6],
  ['list_entry',      'modern',   20],
  ['list_entry',      'classic',  17],
  ['list_entry',      'deadball',  7],
  ['list_entry',      'founding',  6],
];

const ERA_LABELS = {
  modern:   'modern era (1980-present)',
  classic:  'classic era (1920-1979)',
  deadball: 'dead ball era (1900-1919)',
  founding: 'founding era (pre-1900)',
};

for (const [type, era, count] of CONFIGS) {
  for (let i = 0; i < count; i++) PLAN.push({ type, era });
}

// Shuffle
for (let i = PLAN.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [PLAN[i], PLAN[j]] = [PLAN[j], PLAN[i]];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function generateOne(type, era, rejectedTexts = [], attempt = 1) {
  const eraLabel = ERA_LABELS[era] || era;
  const rejectionNote = rejectedTexts.length > 0
    ? `\n\nPREVIOUS ATTEMPTS REJECTED FOR BEING TOO EASY:\n${rejectedTexts.map((q, i) => `${i + 1}. ${q}`).join('\n')}\nGenerate a significantly harder and more obscure question.`
    : '';

  const userPrompt = `Generate a hard baseball trivia question.
Era: ${eraLabel}
Type: ${type}
${type === 'multiple_choice' ? 'Include exactly 4 options.' : ''}
${type === 'list_entry' ? 'correct_answer must be a JSON array of 3-5 items.' : ''}
${type === 'true_false' ? 'correct_answer must be exactly "True" or "False". Must involve specific stats or records.' : ''}
${type === 'type_in' ? 'Ask for a specific number, year, or name requiring genuine recall.' : ''}${rejectionNote}

Return ONLY valid JSON. No markdown.`;

  try {
    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: userPrompt },
    ]);
    const raw = result.response.text().trim();
    const cleaned = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.text || !parsed.type || parsed.correct_answer === undefined) {
      throw new Error('Missing required fields');
    }
    return parsed;
  } catch (err) {
    const msg = String(err.message || err);
    if (msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('RESOURCE_EXHAUSTED')) {
      const retryMatch = msg.match(/"retryDelay":"(\d+)s"/);
      const waitMs = retryMatch ? (parseInt(retryMatch[1]) + 2) * 1000 : 35000;
      process.stdout.write(`[rate-limit: wait ${Math.round(waitMs/1000)}s] `);
      await sleep(waitMs);
      return generateOne(type, era, rejectedTexts, attempt);
    }
    if (attempt < 3) {
      await sleep(2000);
      return generateOne(type, era, rejectedTexts, attempt + 1);
    }
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Peck's Per Nine Question Bank Seeder ===");
  console.log(`Target: ${PLAN.length} hard questions | Model: gemini-2.5-flash\n`);

  // Verify table exists
  const { error: tableCheck } = await supabase.from('question_bank').select('id').limit(1);
  if (tableCheck?.code === 'PGRST205') {
    console.error('ERROR: question_bank table does not exist.');
    console.error('Run supabase/migrations/001_initial_schema.sql in the Supabase SQL editor first.');
    process.exit(1);
  }

  const inserted   = [];
  const failures   = [];
  const rejected   = []; // validator rejections
  let insertErrors = 0;

  const BATCH_SIZE = 10;

  for (let batchStart = 0; batchStart < PLAN.length; batchStart += BATCH_SIZE) {
    const batch = PLAN.slice(batchStart, batchStart + BATCH_SIZE);
    const batchNum     = Math.floor(batchStart / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(PLAN.length / BATCH_SIZE);

    console.log(`── Batch ${batchNum}/${totalBatches} (Q${batchStart + 1}–Q${Math.min(batchStart + BATCH_SIZE, PLAN.length)}) ──`);

    const rows    = [];
    const rowMeta = [];

    for (let i = 0; i < batch.length; i++) {
      const { type, era } = batch[i];
      const qNum = batchStart + i + 1;
      process.stdout.write(`  Q${String(qNum).padStart(3, ' ')} [${type.padEnd(16)}/${era.padEnd(8)}] `);

      // Attempt generation with validator loop
      let question   = null;
      const rejectedTexts = [];
      const MAX_VALIDATOR_RETRIES = 3;

      for (let vAttempt = 0; vAttempt < MAX_VALIDATOR_RETRIES; vAttempt++) {
        const q = await generateOne(type, era, rejectedTexts);
        if (!q) break;

        if (isQuestionTooEasy(q.text) || q.text.length < 80) {
          process.stdout.write(`[rejected: too easy, retry ${vAttempt + 1}] `);
          rejectedTexts.push(q.text);
          rejected.push({ qNum, type, era, text: q.text });
          await sleep(3000);
          continue;
        }

        question = q;
        break;
      }

      if (!question) {
        console.log('✗ FAILED (all retries)');
        failures.push({ qNum, type, era });
      } else {
        rows.push({
          text:           question.text,
          type:           question.type || type,
          difficulty:     'hard',
          options:        question.options || null,
          correct_answer: question.correct_answer,
          explanation:    question.explanation || null,
          era,
          category:       question.category || null,
          times_used:     0,
        });
        rowMeta.push({ type, era });
        console.log(`✓  "${question.text.slice(0, 60)}..."`);
      }

      // Rate limit: 6s between requests (stay under 10 RPM free tier)
      if (i < batch.length - 1) await sleep(6000);
    }

    if (rows.length > 0) {
      const { error } = await supabase.from('question_bank').insert(rows);
      if (error) {
        console.error(`  !! INSERT ERROR: ${error.message}`);
        insertErrors += rows.length;
      } else {
        for (const m of rowMeta) inserted.push(m);
        console.log(`  → Inserted ${rows.length} rows\n`);
      }
    } else {
      console.log(`  → Nothing to insert\n`);
    }
  }

  // ── Final DB count ────────────────────────────────────────────────────────────
  const { count: dbCount, error: countErr } = await supabase
    .from('question_bank')
    .select('*', { count: 'exact', head: true });
  const dbTotal = countErr ? `ERROR: ${countErr.message}` : dbCount;

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const byType = { multiple_choice: 0, true_false: 0, type_in: 0, list_entry: 0 };
  const byEra  = { modern: 0, classic: 0, deadball: 0, founding: 0 };
  for (const { type, era } of inserted) {
    if (type in byType) byType[type]++;
    if (era  in byEra)  byEra[era]++;
  }

  // ── Write seed log ────────────────────────────────────────────────────────────
  const logDir  = '/Users/joepenclaw/openclaw/pecksternine';
  mkdirSync(logDir, { recursive: true });
  const logPath = `${logDir}/seed-log.md`;

  const logContent = `# Peck's Per Nine — Question Bank Seed Log
Generated: ${new Date().toISOString()}

## Summary
| Metric | Value |
|--------|-------|
| Attempted | ${PLAN.length} |
| Successfully Inserted | ${inserted.length} |
| Validator Rejections (too easy) | ${rejected.length} |
| Generation Failures | ${failures.length} |
| Insert Errors | ${insertErrors} |
| **DB Row Count** | **${dbTotal}** |

## Breakdown by Type
| Type | Target | Inserted |
|------|--------|----------|
| multiple_choice | 50 | ${byType.multiple_choice} |
| true_false | 50 | ${byType.true_false} |
| type_in | 50 | ${byType.type_in} |
| list_entry | 50 | ${byType.list_entry} |
| **Total** | **200** | **${inserted.length}** |

## Breakdown by Era
| Era | Target | Inserted |
|-----|--------|----------|
| modern (1980–present) | 80 | ${byEra.modern} |
| classic (1920–1979) | 70 | ${byEra.classic} |
| deadball (1900–1919) | 30 | ${byEra.deadball} |
| founding (pre-1900) | 20 | ${byEra.founding} |
| **Total** | **200** | **${inserted.length}** |

## Generation Failures
${failures.length === 0 ? 'None.' : failures.map(f => `- Q${f.qNum}: ${f.type} / ${f.era}`).join('\n')}

## Validator Rejections (too easy, regenerated)
${rejected.length === 0 ? 'None.' : rejected.map(r => `- Q${r.qNum} [${r.type}/${r.era}]: "${r.text.slice(0, 80)}..."`).join('\n')}

## DB Verification
\`SELECT COUNT(*) FROM question_bank;\` → **${dbTotal} rows**
${typeof dbTotal === 'number' && dbTotal >= 180
  ? '✅ 180+ rows confirmed — question bank seeded successfully.'
  : '⚠️  Row count below 180 — review failures above.'}

## Config
- Model: gemini-2.5-flash
- All questions: difficulty=hard
- Validator: isQuestionTooEasy() + 80-char minimum
- Max validator retries per question: 3
- Batch size: 10
- API delay: 6s between requests
`;

  writeFileSync(logPath, logContent, 'utf8');

  // ── Console summary ───────────────────────────────────────────────────────────
  console.log('\n=== DONE ===');
  console.log(`Inserted: ${inserted.length}/${PLAN.length}  |  Rejected (too easy): ${rejected.length}  |  Failures: ${failures.length}  |  Insert errors: ${insertErrors}`);
  console.log(`DB row count: ${dbTotal}`);
  console.log(`Seed log written to: ${logPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
