import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 빌드 시 미리 실행(정적 생성)되지 않도록 — DB 접속은 실제 요청이 올 때만
export const dynamic = 'force-dynamic';

// 평면 카테고리 목록 (정치/국제/사회/문화) — 글쓰기 화면 셀렉트박스용
export async function GET() {
  const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });
  return NextResponse.json(categories);
}
