import { NextRequest, NextResponse } from 'next/server';
import { saveScore } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const gameId = await saveScore(body);
    return NextResponse.json({ success: true, gameId });
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
