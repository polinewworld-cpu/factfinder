import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 평면 카테고리 목록 (정치/국제/사회/문화) — 글쓰기 화면 셀렉트박스용
export async function GET() {
  const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });
  return NextResponse.json(categories);
}
