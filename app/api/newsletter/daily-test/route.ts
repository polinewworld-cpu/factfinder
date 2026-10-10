import { NextRequest, NextResponse } from 'next/server';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { buildDailyNewsletter } from '@/lib/dailyNewsletter';
import { kstDate, personalize } from '@/lib/newsletter';
import { sendGmail } from '@/lib/gmail';

// [일간 샘플 테스트 발송] (2026-10-10) — 아침 브리핑(정치신세계 어제 방송 요약 + 기사/기자 브리핑)을 편집장 본인 메일로만 한 통.
// 구독자에게는 아직 보내지 않음. body: { date? } 없으면 오늘 아침 기준. 방송 요약(영상 분석)에 시간이 걸려 길게 기다림.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== ROLES.CHIEF_EDITOR || !user.email) return NextResponse.json({ error: '편집장만 보낼 수 있습니다' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const date = typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : kstDate();
  try {
    const r = await buildDailyNewsletter(date);
    if (r.skip) return NextResponse.json({ ok: true, skipped: true, note: r.skip, info: r.info });
    await sendGmail({ to: user.email, subject: `[테스트] ${r.subject}`, html: personalize(r.html) });
    return NextResponse.json({ ok: true, to: user.email, info: r.info });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '발송 실패' }, { status: 502 });
  }
}
