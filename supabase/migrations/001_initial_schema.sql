-- ============================================================
-- Peck's Per Nine — Full Initial Schema
-- Run once against your Supabase project via the SQL editor
-- or via: psql $DATABASE_URL -f supabase/migrations/001_initial_schema.sql
-- ============================================================

-- ── players ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.players (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text UNIQUE NOT NULL,
  display_name    text,
  current_streak  integer NOT NULL DEFAULT 0,
  best_streak     integer NOT NULL DEFAULT 0,
  last_seen       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── games ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.games (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id           uuid REFERENCES public.players(id) ON DELETE SET NULL,
  score               integer NOT NULL DEFAULT 0,
  questions_answered  integer NOT NULL DEFAULT 0,
  correct_answers     integer NOT NULL DEFAULT 0,
  streak_max          integer NOT NULL DEFAULT 0,
  mode                text,
  time_spent          integer,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS games_player_id_idx ON public.games (player_id);
CREATE INDEX IF NOT EXISTS games_score_idx     ON public.games (score DESC);
CREATE INDEX IF NOT EXISTS games_created_at_idx ON public.games (created_at DESC);

-- ── daily_question ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_question (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_date   date UNIQUE NOT NULL,
  question_data   jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── daily_results ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_results (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   uuid REFERENCES public.players(id) ON DELETE SET NULL,
  correct     boolean NOT NULL DEFAULT false,
  time_taken  integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS daily_results_player_id_idx ON public.daily_results (player_id);

-- ── daily_archives ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_archives (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       uuid REFERENCES public.players(id) ON DELETE SET NULL,
  correct         boolean NOT NULL DEFAULT false,
  time_taken      integer,
  archived_date   date NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS daily_archives_date_idx ON public.daily_archives (archived_date);

-- ── rate_limits ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address      text NOT NULL,
  window_date     date NOT NULL,
  request_count   integer NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ip_address, window_date)
);
CREATE INDEX IF NOT EXISTS rate_limits_window_date_idx ON public.rate_limits (window_date);

-- ── system_logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_logs (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date                        date NOT NULL,
  daily_question_generated    boolean NOT NULL DEFAULT false,
  archives_complete           boolean NOT NULL DEFAULT false,
  usage_count                 integer NOT NULL DEFAULT 0,
  alerts_sent                 boolean NOT NULL DEFAULT false,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

-- ── question_bank ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.question_bank (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text            text NOT NULL,
  type            text NOT NULL CHECK (type IN ('multiple_choice','true_false','type_in','list_entry')),
  difficulty      text NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  options         jsonb,
  correct_answer  jsonb NOT NULL,
  explanation     text,
  era             text,
  category        text,
  times_used      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS question_bank_difficulty_idx  ON public.question_bank (difficulty);
CREATE INDEX IF NOT EXISTS question_bank_times_used_idx  ON public.question_bank (times_used);
CREATE INDEX IF NOT EXISTS question_bank_era_idx         ON public.question_bank (era);

-- ── leaderboard views ─────────────────────────────────────────
CREATE OR REPLACE VIEW public.leaderboard_alltime AS
SELECT
  p.display_name,
  p.email,
  SUM(g.score)            AS total_score,
  COUNT(g.id)             AS games_played,
  MAX(g.score)            AS best_game,
  SUM(g.correct_answers)  AS total_correct,
  p.best_streak
FROM public.players p
JOIN public.games g ON g.player_id = p.id
GROUP BY p.id, p.display_name, p.email, p.best_streak
ORDER BY total_score DESC;

CREATE OR REPLACE VIEW public.leaderboard_bestgame AS
SELECT
  p.display_name,
  p.email,
  MAX(g.score)  AS best_game,
  g.mode,
  g.created_at
FROM public.players p
JOIN public.games g ON g.player_id = p.id
GROUP BY p.id, p.display_name, p.email, g.mode, g.created_at
ORDER BY best_game DESC;

CREATE OR REPLACE VIEW public.leaderboard_today AS
SELECT
  p.display_name,
  p.email,
  g.score,
  g.correct_answers,
  g.mode,
  g.created_at
FROM public.players p
JOIN public.games g ON g.player_id = p.id
WHERE g.created_at >= CURRENT_DATE
ORDER BY g.score DESC;

-- ── Row Level Security ────────────────────────────────────────
-- Enable RLS on all tables
ALTER TABLE public.players         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_question  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_results   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_archives  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank   ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — no policies needed for service role.
-- Anon/public read-only policies where needed:

-- Allow anon to read daily_question (needed for /api/daily-question)
CREATE POLICY IF NOT EXISTS "public read daily_question"
  ON public.daily_question FOR SELECT TO anon, authenticated USING (true);

-- Allow anon to read question_bank (needed for fallback)
CREATE POLICY IF NOT EXISTS "public read question_bank"
  ON public.question_bank FOR SELECT TO anon, authenticated USING (true);

-- Allow anon to read leaderboard views (via games + players join)
CREATE POLICY IF NOT EXISTS "public read games"
  ON public.games FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY IF NOT EXISTS "public read players"
  ON public.players FOR SELECT TO anon, authenticated USING (true);
