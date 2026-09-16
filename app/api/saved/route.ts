import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

// 내가 저장한 기사 목록 (기능정의서 3.1, 프로필 페이지에서 사용)
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const saved = await prisma.savedArticle.findMany({
    where: { userId: user.id },
    include: { article: { include: { author: true, category: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(saved.map((s) => s.article));
}
