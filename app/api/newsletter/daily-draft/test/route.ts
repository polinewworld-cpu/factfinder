import { NextRequest, NextResponse } from 'next/server';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { renderDailyDraft, saveDraft } from '@/lib/dailyNewsletter';
import { sanitizeDraft } from '@/lib/dailyDraftInput';
import { personalize } from '@/lib/newsletter';
import { sendGmail } from '@/lib/gmail';

// 고친 초안을 편집장 본인 메일로만 한 통 테스트 발송 (2026-10-10). 구독자에게는 나가지 않음. 초안도 같이 저장.
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== ROLES.CHIEF_EDITOR || !user.email) return NextResponse.json({ error: '편집장만 보낼 수 있습니다' }, { status: 403 });
  const draft = sanitizeDraft((await req.json().catch(() => ({}))).draft);
  if (!draft) return NextResponse.json({ error: '초안 형식이 올바르지 않습니다' }, { status: 400 });
  try {
    await saveDraft(draft);
    const { subject, html } = await renderDailyDraft(draft);
    await sendGmail({ to: user.email, subject: `[테스트] ${subject}`, html: personalize(html) });
    return NextResponse.json({ ok: true, to: user.email });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '발송 실패' }, { status: 502 });
  }
}
