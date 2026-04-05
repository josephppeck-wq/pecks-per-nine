import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const type = (req.nextUrl.searchParams.get('type') || 'alltime') as
    | 'alltime'
    | 'bestgame'
    | 'today';
  const data = await getLeaderboard(type);
  return NextResponse.json(data);
}
