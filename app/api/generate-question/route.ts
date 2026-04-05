import { NextRequest, NextResponse } from 'next/server';
import { generateQuestion } from '@/lib/gemini';
import { checkRateLimit } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded', fallback: true }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { difficulty, category, era, questionType, usedQuestions } = body;
    const question = await generateQuestion(difficulty, category, era, questionType, usedQuestions);
    return NextResponse.json({ question });
  } catch {
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
