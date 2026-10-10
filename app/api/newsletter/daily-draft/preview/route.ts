import { NextRequest, NextResponse } from 'next/server';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { renderDailyDraft } from '@/lib/dailyNewsletter';
import { sanitizeDraft } from '@/lib/dailyDraftInput';
import { personalize } from '@/lib/newsletter';

// 고친 초안으로 메일 미리보기 HTML (2026-10-10) — 편집장 전용, 저장 전에도 볼 수 있게 초안을 그대로 받음
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== ROLES.CHIEF_EDITOR) return NextResponse.json({ error: '편집장만 볼 수 있습니다' }, { status: 403 });
  const draft = sanitizeDraft((await req.json().catch(() => ({}))).draft);
  if (!draft) return NextResponse.json({ error: '초안 형식이 올바르지 않습니다' }, { status: 400 });
  const { subject, html } = await renderDailyDraft(draft);
  return NextResponse.json({ subject, html: personalize(html) });
}
