import { NextRequest, NextResponse } from 'next/server';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { buildNewsletter, DEFAULT_GREETING, personalize, upcomingSaturday, weeklyPicks } from '@/lib/newsletter';
import { sendGmail } from '@/lib/gmail';

// [나에게 테스트 발송] (2026-10-10) — 편집장 본인 메일로 한 통. body: { ids?, greeting? } 없으면 이번 토요일 자동 선정 기사
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== ROLES.CHIEF_EDITOR || !user.email) return NextResponse.json({ error: '편집장만 보낼 수 있습니다' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const week = upcomingSaturday();
  const ids: string[] = Array.isArray(b.ids) && b.ids.length ? b.ids.map(String) : await weeklyPicks(week);
  if (!ids.length) return NextResponse.json({ error: '보낼 기사가 없습니다' }, { status: 400 });
  const greeting = typeof b.greeting === 'string' && b.greeting.trim() ? b.greeting : DEFAULT_GREETING;
  const { subject, html } = await buildNewsletter(ids, greeting, week);
  try {
    await sendGmail({ to: user.email, subject: `[테스트] ${subject}`, html: personalize(html) });
    return NextResponse.json({ ok: true, to: user.email });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '발송 실패' }, { status: 502 });
  }
}
