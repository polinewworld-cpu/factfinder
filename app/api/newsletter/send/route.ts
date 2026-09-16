import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { buildWeeklyDigest, currentWeekRange } from '@/lib/newsletter';
import { isEmailConfigured, sendEmailBatch } from '@/lib/resend';

// 뉴스레터 실제 발송 — 옵트인한 회원 전체 대상 (기능정의서 6)
// 이메일 발송 인프라(RESEND_API_KEY, NEWSLETTER_FROM_EMAIL)가 설정돼 있어야 동작함.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 발송할 수 있습니다' }, { status: 403 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: '이메일 발송 설정(RESEND_API_KEY, NEWSLETTER_FROM_EMAIL 환경변수)이 되어있지 않습니다' },
      { status: 400 }
    );
  }

  const { start: startParam, end: endParam } = await req.json().catch(() => ({}));
  const { start, end } = startParam && endParam
    ? { start: new Date(startParam), end: (() => { const d = new Date(endParam); d.setHours(23, 59, 59, 999); return d; })() }
    : currentWeekRange();

  const [{ subject, html }, subscribers] = await Promise.all([
    buildWeeklyDigest(start, end),
    prisma.user.findMany({ where: { newsletterOptIn: true }, select: { email: true } }),
  ]);

  if (subscribers.length === 0) {
    return NextResponse.json({ error: '구독자가 없습니다' }, { status: 400 });
  }

  const { sent, failed } = await sendEmailBatch(
    subscribers.map((s) => s.email),
    { subject, html }
  );

  await prisma.newsletterSend.create({
    data: { weekStart: start, weekEnd: end, recipientCount: sent },
  });

  return NextResponse.json({ sent, failed, total: subscribers.length });
}
