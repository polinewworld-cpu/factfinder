import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { CARD_ARTICLE_SELECT } from '@/lib/publicFields';

// 내가 저장한 기사 목록 (기능정의서 3.1, 프로필 페이지에서 사용)
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const saved = await prisma.savedArticle.findMany({
    where: { userId: user.id, article: { status: 'PUBLISHED' } },
    select: { article: { select: { ...CARD_ARTICLE_SELECT, content: false } } }, // 다른 기자 이메일·계좌가 실리던 문제 (2026-10-09)
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(saved.map((s) => s.article));
}
