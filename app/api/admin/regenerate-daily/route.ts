/**
 * /api/admin/regenerate-daily
 *
 * One-shot endpoint to force-regenerate today's daily question.
 * Deletes the current row for today and calls generateDailyQuestion
 * with the new stricter validator + retry logic.
 *
 * Protected by ADMIN_SECRET header. Never exposed to public.
 * Usage: GET /api/admin/regenerate-daily
 *        Header: x-admin-secret: <ADMIN_SECRET env var>
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateDailyQuestion } from '@/lib/gemini';

function getCTDateStr(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(date);
}

const ERA_BY_DOW: Record<number, string> = {
  0: 'Sabermetrics',
  1: 'Modern',
  2: 'Classic',
  3: 'Deadball',
  4: 'Modern',
  5: 'Classic',
  6: 'Pirates-focused',
};

export async function GET(req: NextRequest) {
  // Auth check
  const adminSecret = req.headers.get('x-admin-secret');
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const todayStr = getCTDateStr(now);

  // Get day of week in CT
  const [year, month, dayNum] = todayStr.split('-').map(Number);
  const dayOfWeek = new Date(`${todayStr}T12:00:00`).getDay();

  // Birthday override
  const era =
    month === 4 && dayNum === 5
      ? 'Pirates-birthday'
      : (ERA_BY_DOW[dayOfWeek] ?? 'Modern');

  // Delete today's existing question
  const { error: deleteError } = await supabaseAdmin
    .from('daily_question')
    .delete()
    .eq('question_date', todayStr);

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete existing question', detail: deleteError.message }, { status: 500 });
  }

  // Generate new question with stricter validator
  let question;
  try {
    question = await generateDailyQuestion(era, 'hard', dayOfWeek);
  } catch (err) {
    return NextResponse.json({ error: 'Generation failed', detail: String(err) }, { status: 500 });
  }

  // Insert
  const { error: insertError } = await supabaseAdmin
    .from('daily_question')
    .insert({ question_data: question, question_date: todayStr });

  if (insertError) {
    return NextResponse.json({ error: 'Failed to insert question', detail: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    date: todayStr,
    era,
    dayOfWeek,
    question: {
      text: question.text,
      type: question.type,
      difficulty: question.difficulty,
      correct_answer: question.correct_answer,
    },
  });
}
