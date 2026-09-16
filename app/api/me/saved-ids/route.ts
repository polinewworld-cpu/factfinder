import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

// 로그인 사용자가 저장한 기사 id 목록만 가볍게 반환 — 카드 그리드에서 북마크 채움 여부를 표시하기 위한 용도
// (전체 기사 데이터가 필요한 "저장한 기사" 목록 화면은 /saved 페이지에서 직접 조회)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json([]);

  const saved = await prisma.savedArticle.findMany({
    where: { userId: user.id },
    select: { articleId: true },
  });
  return NextResponse.json(saved.map((s) => s.articleId));
}
