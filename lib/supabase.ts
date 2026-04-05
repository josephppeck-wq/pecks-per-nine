import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function checkRateLimit(ip: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data, error } = await supabaseAdmin
      .from('rate_limits')
      .select('request_count')
      .eq('ip_address', ip)
      .eq('window_date', today)
      .single();

    if (error && error.code !== 'PGRST116') return true; // allow on DB error

    if (!data) {
      await supabaseAdmin
        .from('rate_limits')
        .insert({ ip_address: ip, window_date: today, request_count: 1 });
      return true;
    }

    if (data.request_count >= 100) return false;

    await supabaseAdmin
      .from('rate_limits')
      .update({ request_count: data.request_count + 1 })
      .eq('ip_address', ip)
      .eq('window_date', today);

    return true;
  } catch {
    return true; // allow on error
  }
}

export async function saveScore(data: {
  email?: string;
  displayName?: string;
  score: number;
  questionsAnswered: number;
  correctAnswers: number;
  streakMax: number;
  mode: string;
  timeSpent: number;
}): Promise<string | null> {
  try {
    let playerId: string | null = null;

    if (data.email) {
      const { data: player, error: playerError } = await supabaseAdmin
        .from('players')
        .upsert(
          {
            email: data.email,
            display_name: data.displayName || data.email.split('@')[0],
            last_seen: new Date().toISOString(),
          },
          { onConflict: 'email' }
        )
        .select('id')
        .single();

      if (!playerError && player) playerId = player.id;
    }

    const { data: game } = await supabaseAdmin
      .from('games')
      .insert({
        player_id: playerId,
        score: data.score,
        questions_answered: data.questionsAnswered,
        correct_answers: data.correctAnswers,
        streak_max: data.streakMax,
        mode: data.mode,
        time_spent: data.timeSpent,
      })
      .select('id')
      .single();

    return game?.id || null;
  } catch {
    return null;
  }
}

export async function getDailyQuestion() {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('daily_question')
    .select('question_data')
    .eq('question_date', today)
    .single();
  return data?.question_data || null;
}

export async function setDailyQuestion(question: object) {
  const today = new Date().toISOString().split('T')[0];
  await supabaseAdmin
    .from('daily_question')
    .upsert({ question_data: question, question_date: today }, { onConflict: 'question_date' });
}

export async function getLeaderboard(type: 'alltime' | 'bestgame' | 'today') {
  const views: Record<string, string> = {
    alltime: 'leaderboard_alltime',
    bestgame: 'leaderboard_bestgame',
    today: 'leaderboard_today',
  };
  const { data } = await supabase.from(views[type]).select('*').limit(50);
  return data || [];
}

export async function submitDailyResult(data: {
  email?: string;
  correct: boolean;
  timeTaken: number;
}) {
  let playerId = null;
  if (data.email) {
    const { data: player } = await supabaseAdmin
      .from('players')
      .upsert({ email: data.email, last_seen: new Date().toISOString() }, { onConflict: 'email' })
      .select('id')
      .single();
    playerId = player?.id;
  }
  await supabaseAdmin.from('daily_results').insert({
    player_id: playerId,
    correct: data.correct,
    time_taken: data.timeTaken,
  });
}

export async function sendMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
    },
  });
  if (error) throw error;
}
