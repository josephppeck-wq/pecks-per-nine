import { NextRequest, NextResponse } from 'next/server';
import { sendResultsEmail } from '@/lib/resend';
import { isBirthday } from '@/lib/birthday';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await sendResultsEmail({ ...body, isBirthday: isBirthday() });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to send';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
