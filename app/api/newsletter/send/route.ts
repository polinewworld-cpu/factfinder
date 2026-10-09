import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { buildNewsletter } from '@/lib/newsletter';
import { isEmailConfigured, sendEmailBatch } from '@/lib/resend';

// 뉴스레터 실제 발송 — 편집장이 고른 기사 + 인사말, 옵트인한 회원 전체 대상 (기능정의서 6, 2026-10-09 선택 발송으로 변경)
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

  const { ids, greeting } = await req.json().catch(() => ({}));
  const [{ subject, html, articles }, subscribers] = await Promise.all([
    buildNewsletter(Array.isArray(ids) ? ids.map(String) : [], String(greeting ?? '')),
    prisma.user.findMany({ where: { newsletterOptIn: true }, select: { email: true } }),
  ]);

  if (articles.length === 0) return NextResponse.json({ error: '보낼 기사를 하나 이상 고르세요' }, { status: 400 });
  if (subscribers.length === 0) return NextResponse.json({ error: '구독자가 없습니다' }, { status: 400 });

  const { sent, failed } = await sendEmailBatch(
    subscribers.map((s) => s.email),
    { subject, html }
  );

  // 기록용 기간 = 고른 기사들의 발행일 범위
  const dates = articles.map((a) => (a.publishedAt ?? a.createdAt).getTime());
  await prisma.newsletterSend.create({
    data: { weekStart: new Date(Math.min(...dates)), weekEnd: new Date(Math.max(...dates)), recipientCount: sent },
  });

  return NextResponse.json({ sent, failed, total: subscribers.length });
}
