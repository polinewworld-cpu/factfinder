import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { buildWeeklyDigest, currentWeekRange } from '@/lib/newsletter';
import { isEmailConfigured } from '@/lib/resend';

// 이번 주(또는 지정 범위) 발행 예정 뉴스레터 미리보기 + 발송 설정/구독자 수 확인 (기능정의서 6)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 볼 수 있습니다' }, { status: 403 });
  }

  const startParam = req.nextUrl.searchParams.get('start');
  const endParam = req.nextUrl.searchParams.get('end');
  const { start, end } = startParam && endParam
    ? { start: new Date(startParam), end: (() => { const d = new Date(endParam); d.setHours(23, 59, 59, 999); return d; })() }
    : currentWeekRange();

  const [{ articles, subject, html }, subscriberCount] = await Promise.all([
    buildWeeklyDigest(start, end),
    prisma.user.count({ where: { newsletterOptIn: true } }),
  ]);

  return NextResponse.json({
    start,
    end,
    subject,
    html,
    articleCount: articles.length,
    subscriberCount,
    emailConfigured: isEmailConfigured(),
  });
}
