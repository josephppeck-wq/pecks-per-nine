import { NextResponse } from 'next/server';
import { setDailyQuestion } from '@/lib/supabase';
import { generateQuestion } from '@/lib/gemini';

export async function GET() {
  const question = await generateQuestion('medium');
  if (question) {
    await setDailyQuestion(question);
    return NextResponse.json({ success: true, questionId: question.id });
  }
  return NextResponse.json({ error: 'Failed to generate' }, { status: 500 });
}
