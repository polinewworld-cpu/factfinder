import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WRITER_ROLES } from '@/lib/roles';

// 후원 시 "특정 기자 응원하기" 선택용 — 공개 목록 (기능정의서 7). 이름/닉네임만 노출.
export async function GET() {
  const reporters = await prisma.user.findMany({
    where: { role: { in: WRITER_ROLES as any } },
    select: { id: true, name: true, nickname: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(reporters);
}
