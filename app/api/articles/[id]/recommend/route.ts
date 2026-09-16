import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 기사 "추천" 버튼 — 로그인 불필요, 중복 방지는 클라이언트(localStorage)에서만 best-effort로 처리 (2026-09-12 신설)
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const updated = await prisma.article.update({
    where: { id: params.id },
    data: { recommendCount: { increment: 1 } },
  });

  return NextResponse.json({ recommendCount: updated.recommendCount });
}
