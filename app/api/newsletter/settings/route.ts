import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { upcomingSaturday } from '@/lib/newsletter';

// 자동 발송 켜기·끄기, 이번 주 건너뛰기 (2026-10-10) — body: { auto?: boolean, skipThisWeek?: boolean }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== ROLES.CHIEF_EDITOR) return NextResponse.json({ error: '편집장만 바꿀 수 있습니다' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const data: { newsletterAuto?: boolean; newsletterSkipWeek?: string | null } = {};
  if (typeof b.auto === 'boolean') data.newsletterAuto = b.auto;
  if (typeof b.skipThisWeek === 'boolean') data.newsletterSkipWeek = b.skipThisWeek ? upcomingSaturday() : null;
  await prisma.siteConfig.upsert({ where: { id: 'singleton' }, update: data, create: { id: 'singleton', ...data } });
  return NextResponse.json({ ok: true });
}
