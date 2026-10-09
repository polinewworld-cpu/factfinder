import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WRITER_ROLES } from '@/lib/roles';

// 요청마다 DB에서 읽음 — 없으면 Next가 배포(빌드) 때 한 번 만든 응답을 계속 돌려줘, 관리자 설정·기자 목록 변경이 다음 배포 전까지 안 보였음 (2026-10-09)
export const dynamic = 'force-dynamic';

// 후원 시 "특정 기자 응원하기" 선택용 — 공개 목록 (기능정의서 7). 이름/닉네임만 노출.
export async function GET() {
  const reporters = await prisma.user.findMany({
    where: { role: { in: WRITER_ROLES as any }, ghost: false }, // 유령 계정 제외 (2026-10-08)
    select: { id: true, name: true, nickname: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(reporters);
}
