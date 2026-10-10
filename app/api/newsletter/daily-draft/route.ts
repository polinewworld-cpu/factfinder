import { NextRequest, NextResponse } from 'next/server';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { buildDailyDraft, loadDraft, saveDraft, type DailyResultInfo } from '@/lib/dailyNewsletter';
import { sanitizeDraft } from '@/lib/dailyDraftInput';
import { kstDate, selectedArticles } from '@/lib/newsletter';

// 일간 아침 브리핑 초안 (2026-10-10) — 편집장 전용.
// GET ?date=  : 저장된 초안(+기사 제목)과 만들기 진행 상황 / POST {date}: 초안 만들기 시작(방송 영상 요약이 몇 분 걸려 서버가 뒤에서 만들고 화면은 진행을 확인)
// PUT {draft}: 관리자가 고친 문장 저장
export const dynamic = 'force-dynamic';

type Job = { state: 'running' | 'done' | 'error'; startedAt: number; date: string; skipped?: boolean; note?: string; message?: string; info?: DailyResultInfo };
let job: Job | null = null;

async function chief() {
  const user = await getCurrentUser();
  return user?.role === ROLES.CHIEF_EDITOR ? user : null;
}
const dateOf = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : kstDate());

export async function GET(req: NextRequest) {
  if (!(await chief())) return NextResponse.json({ error: '편집장만 볼 수 있습니다' }, { status: 403 });
  const date = dateOf(req.nextUrl.searchParams.get('date'));
  const draft = await loadDraft(date);
  const arts = draft ? await selectedArticles(draft.articleIds) : [];
  return NextResponse.json({ date, draft, articles: arts.map((a) => ({ id: a.id, title: a.title })), job: job && job.date === date ? job : null });
}

export async function POST(req: NextRequest) {
  if (!(await chief())) return NextResponse.json({ error: '편집장만 만들 수 있습니다' }, { status: 403 });
  if (job?.state === 'running' && Date.now() - job.startedAt < 15 * 60_000) return NextResponse.json({ state: 'running', already: true });
  const date = dateOf((await req.json().catch(() => ({}))).date);
  const started: Job = { state: 'running', startedAt: Date.now(), date };
  job = started;
  void (async () => {
    try {
      const r = await buildDailyDraft(date);
      job = r.skip ? { ...started, state: 'done', skipped: true, note: r.skip, info: r.info } : { ...started, state: 'done', info: r.info };
    } catch (e) {
      console.error('[daily-draft]', e);
      job = { ...started, state: 'error', message: e instanceof Error ? e.message : '초안을 만들지 못했습니다' };
    }
  })();
  return NextResponse.json({ state: 'running' });
}

export async function PUT(req: NextRequest) {
  if (!(await chief())) return NextResponse.json({ error: '편집장만 저장할 수 있습니다' }, { status: 403 });
  const draft = sanitizeDraft((await req.json().catch(() => ({}))).draft);
  if (!draft) return NextResponse.json({ error: '초안 형식이 올바르지 않습니다' }, { status: 400 });
  await saveDraft(draft);
  return NextResponse.json({ ok: true, draft });
}
