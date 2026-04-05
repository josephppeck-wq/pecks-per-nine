import { NextResponse } from 'next/server';
import { getDailyQuestion, setDailyQuestion } from '@/lib/supabase';
import { generateQuestion } from '@/lib/gemini';

export async function GET() {
  let question = await getDailyQuestion();
  if (!question) {
    question = await generateQuestion('medium');
    if (question) await setDailyQuestion(question);
  }
  if (!question) return NextResponse.json({ error: 'No daily question' }, { status: 404 });
  return NextResponse.json({ question });
}
