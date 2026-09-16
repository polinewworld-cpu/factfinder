import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 정치신세계 카드 목록 — 공개 (기능정의서 4.2.1)
export async function GET() {
  const cards = await prisma.videoCard.findMany({ orderBy: { publishedAt: 'desc' }, take: 60 });
  return NextResponse.json(cards);
}
