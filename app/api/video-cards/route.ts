import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 요청마다 DB에서 읽음 — 없으면 Next가 배포(빌드) 때 한 번 만든 응답을 계속 돌려줘, 관리자 설정·기자 목록 변경이 다음 배포 전까지 안 보였음 (2026-10-09)
export const dynamic = 'force-dynamic';

// 정치신세계 카드 목록 — 공개 (기능정의서 4.2.1)
export async function GET() {
  const cards = await prisma.videoCard.findMany({ orderBy: { publishedAt: 'desc' }, take: 60 });
  return NextResponse.json(cards);
}
