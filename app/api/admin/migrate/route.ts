/**
 * /api/admin/migrate
 * One-shot migration endpoint — creates question_bank table if it doesn't exist.
 * Protected by x-admin-secret header.
 * Safe to call multiple times (IF NOT EXISTS).
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS public.question_bank (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text          text NOT NULL,
  type          text NOT NULL CHECK (type IN ('multiple_choice','true_false','type_in','list_entry')),
  difficulty    text NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  options       jsonb,
  correct_answer jsonb NOT NULL,
  explanation   text,
  era           text,
  category      text,
  times_used    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS question_bank_difficulty_idx ON public.question_bank (difficulty);
CREATE INDEX IF NOT EXISTS question_bank_times_used_idx ON public.question_bank (times_used);
`;

export async function GET(req: NextRequest) {
  const adminSecret = req.headers.get('x-admin-secret');
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Execute via rpc — we'll use a raw pg query via the REST API workaround:
  // Insert a dummy row with a known-bad type to check table existence,
  // or use supabase's built-in .rpc approach if available.
  // Best available option: use supabase-js to call a pg function.
  // Since exec_sql isn't available, we create the table by attempting
  // to insert and catching the "table not found" error, then using
  // the Supabase SQL API via the management REST endpoint.

  // Actually: Supabase REST doesn't expose DDL. We'll use the /pg endpoint
  // available in newer Supabase projects.
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')}/pg/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
    },
    body: JSON.stringify({ query: CREATE_SQL }),
  });

  if (!res.ok) {
    const text = await res.text();
    // If /pg/query not available, fall back to checking if table exists
    // by querying it — if it fails, we know it needs to be created manually
    const { error: checkError } = await supabaseAdmin
      .from('question_bank')
      .select('id')
      .limit(1);

    if (checkError?.code === 'PGRST205') {
      return NextResponse.json({
        status: 'TABLE_MISSING',
        message: 'question_bank table does not exist and /pg/query is unavailable. Create it manually via Supabase dashboard.',
        sql: CREATE_SQL,
        pgQueryError: text,
      }, { status: 500 });
    }

    // Table already exists
    return NextResponse.json({ status: 'TABLE_EXISTS', message: 'question_bank already exists' });
  }

  return NextResponse.json({ status: 'MIGRATED', message: 'question_bank table created successfully' });
}
