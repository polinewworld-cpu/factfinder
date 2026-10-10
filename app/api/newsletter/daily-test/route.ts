import { NextRequest, NextResponse } from 'next/server';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { buildDailyNewsletter, type DailyResult } from '@/lib/dailyNewsletter';
import { kstDate, personalize } from '@/lib/newsletter';
import { sendGmail } from '@/lib/gmail';

// [일간 샘플 테스트 발송] (2026-10-10) — 아침 브리핑(정치신세계 어제 방송 요약 + 기사/기자 브리핑)을 편집장 본인 메일로만 한 통.
// 구독자에게는 아직 보내지 않음. 방송 영상 요약이 몇 분 걸려 요청을 붙들고 기다리면 연결이 끊기므로,
// POST는 바로 "시작함"만 답하고 서버가 뒤에서 만들어 보낸다 → 화면은 GET으로 진행 상황을 확인(편집장 1명 전용이라 서버 메모리에 상태 보관).
export const dynamic = 'force-dynamic';

type Job = { state: 'running' | 'done' | 'error'; startedAt: number; to?: string; skipped?: boolean; note?: string; message?: string; info?: DailyResult['info'] };
let job: Job | null = null;

async function chief() {
  const user = await getCurrentUser();
  return user?.role === ROLES.CHIEF_EDITOR && user.email ? user : null;
}

export async function GET() {
  if (!(await chief())) return NextResponse.json({ error: '편집장만 볼 수 있습니다' }, { status: 403 });
  return NextResponse.json(job ?? { state: 'idle' });
}

export async function POST(req: NextRequest) {
  const user = await chief();
  if (!user) return NextResponse.json({ error: '편집장만 보낼 수 있습니다' }, { status: 403 });
  if (job?.state === 'running' && Date.now() - job.startedAt < 15 * 60_000) return NextResponse.json({ state: 'running', already: true });
  const b = await req.json().catch(() => ({}));
  const date = typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : kstDate();
  const to = user.email!;
  const started: Job = { state: 'running', startedAt: Date.now() };
  job = started;
  void (async () => {
    try {
      const r = await buildDailyNewsletter(date);
      if (r.skip) {
        job = { ...started, state: 'done', skipped: true, note: r.skip, info: r.info };
        return;
      }
      await sendGmail({ to, subject: `[테스트] ${r.subject}`, html: personalize(r.html) });
      job = { ...started, state: 'done', to, info: r.info };
    } catch (e) {
      console.error('[daily-test]', e);
      job = { ...started, state: 'error', message: e instanceof Error ? e.message : '발송 실패' };
    }
  })();
  return NextResponse.json({ state: 'running' });
}
