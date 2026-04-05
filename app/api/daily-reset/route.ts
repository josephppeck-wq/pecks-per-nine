import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, setDailyQuestion } from '@/lib/supabase';
import { generateDailyQuestion } from '@/lib/gemini';
import { Resend } from 'resend';

const ERA_BY_DOW: Record<number, string> = {
  0: 'Sabermetrics',
  1: 'Modern',
  2: 'Classic',
  3: 'Deadball',
  4: 'Modern',
  5: 'Classic',
  6: 'Pirates-focused',
};

function getCTDateStr(date: Date): string {
  // en-CA locale produces YYYY-MM-DD format
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(date);
}

function getCTDateParts(dateStr: string): { year: number; month: number; day: number; dayOfWeek: number } {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Use local noon on that calendar date to reliably get day-of-week
  const dayOfWeek = new Date(`${dateStr}T12:00:00`).getDay();
  return { year, month, day, dayOfWeek };
}

export async function GET(req: NextRequest) {
  // Security check
  if (process.env.NODE_ENV !== 'development') {
    const cronSecret = req.headers.get('x-vercel-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const now = new Date();
  const todayStr = getCTDateStr(now);
  const { month, day, dayOfWeek } = getCTDateParts(todayStr);

  // Yesterday in CT
  const yesterdayStr = getCTDateStr(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  let dailyQuestionGenerated = false;
  let archivesComplete = false;
  let usageCount = 0;
  let alertsSent = false;

  // ─── STEP 1: Generate Daily Question ─────────────────────────────────────────
  try {
    const era =
      month === 4 && day === 5
        ? 'Pirates-birthday'
        : (ERA_BY_DOW[dayOfWeek] ?? 'Modern');

    const difficulty: 'hard' = 'hard';

    const question = await generateDailyQuestion(era, difficulty, dayOfWeek);
    await setDailyQuestion(question);
    dailyQuestionGenerated = true;
  } catch (err) {
    console.error('[daily-reset] Step 1 failed:', err);
  }

  // ─── STEP 2: Archive Yesterday ────────────────────────────────────────────────
  try {
    // a) Fetch all daily_results rows before deleting
    const { data: resultsRows, error: fetchError } = await supabaseAdmin
      .from('daily_results')
      .select('player_id, correct, time_taken');

    if (fetchError) throw fetchError;

    const rows = resultsRows ?? [];

    // b) Copy rows into daily_archives
    if (rows.length > 0) {
      const archiveRows = rows.map((r) => ({
        player_id: r.player_id,
        correct: r.correct,
        time_taken: r.time_taken,
        archived_date: yesterdayStr,
      }));
      const { error: archiveError } = await supabaseAdmin
        .from('daily_archives')
        .insert(archiveRows);
      if (archiveError) throw archiveError;
    }

    // c) Delete all rows from daily_results
    await supabaseAdmin.from('daily_results').delete().not('id', 'is', null);

    // d) Update player streaks
    const correctPlayerIds = new Set(
      rows.filter((r) => r.correct && r.player_id).map((r) => r.player_id as string)
    );
    const incorrectPlayerIds = new Set(
      rows.filter((r) => !r.correct && r.player_id).map((r) => r.player_id as string)
    );
    const participatedIds = new Set([...correctPlayerIds, ...incorrectPlayerIds]);

    // Fetch all players with an active streak (needed to find missed players)
    const { data: activePlayers } = await supabaseAdmin
      .from('players')
      .select('id, current_streak, best_streak')
      .gt('current_streak', 0);

    // Reset streaks for players who missed entirely
    const missedIds = (activePlayers ?? [])
      .filter((p) => !participatedIds.has(p.id))
      .map((p) => p.id);

    if (missedIds.length > 0) {
      await supabaseAdmin.from('players').update({ current_streak: 0 }).in('id', missedIds);
    }

    // Reset streaks for players who answered incorrectly
    if (incorrectPlayerIds.size > 0) {
      await supabaseAdmin
        .from('players')
        .update({ current_streak: 0 })
        .in('id', [...incorrectPlayerIds]);
    }

    // Increment streaks for players who answered correctly
    if (correctPlayerIds.size > 0) {
      const { data: correctPlayers } = await supabaseAdmin
        .from('players')
        .select('id, current_streak, best_streak')
        .in('id', [...correctPlayerIds]);

      for (const player of correctPlayers ?? []) {
        const newStreak = (player.current_streak ?? 0) + 1;
        const update: Record<string, number> = { current_streak: newStreak };
        if (newStreak > (player.best_streak ?? 0)) {
          update.best_streak = newStreak;
        }
        await supabaseAdmin.from('players').update(update).eq('id', player.id);
      }
    }

    archivesComplete = true;
  } catch (err) {
    console.error('[daily-reset] Step 2 failed:', err);
  }

  // ─── STEP 3: Usage Report ─────────────────────────────────────────────────────
  try {
    const { data: rateLimitRows } = await supabaseAdmin
      .from('rate_limits')
      .select('request_count')
      .eq('window_date', yesterdayStr);

    usageCount = (rateLimitRows ?? []).reduce(
      (sum, r) => sum + (r.request_count ?? 0),
      0
    );

    if (usageCount > 800) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'alerts@peckspernine.com',
        to: 'joseph.p.peck@gmail.com',
        subject: "Peck's Per Nine — High Usage Alert",
        html: `<p>Yesterday's API usage hit <strong>${usageCount}</strong> requests. Consider increasing the question bank size or adjusting rate limits.</p>`,
      });
      alertsSent = true;
    }

    await supabaseAdmin.from('system_logs').insert({
      date: todayStr,
      daily_question_generated: dailyQuestionGenerated,
      archives_complete: archivesComplete,
      usage_count: usageCount,
      alerts_sent: alertsSent,
    });
  } catch (err) {
    console.error('[daily-reset] Step 3 failed:', err);
  }

  return NextResponse.json({
    success: true,
    dailyQuestionGenerated,
    archivesComplete,
    usageCount,
    alertsSent,
  });
}
