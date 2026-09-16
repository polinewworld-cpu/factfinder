import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 전체 후원리스트 — 대시보드 "후원" 항목에서 진입하는 원본 목록 화면 (기자별 정산 화면과는 별개, 2026-09-11 신설)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 볼 수 있습니다' }, { status: 403 });
  }

  const donations = await prisma.donation.findMany({
    include: {
      // 후원리스트에 닉네임·프로필사진·이메일·연락처를 함께 노출하기 위해 확장 (2026-09-12)
      user: { select: { id: true, name: true, nickname: true, image: true, email: true } },
      reporter: { select: { id: true, name: true } },
    },
    orderBy: { startedAt: 'desc' },
  });

  return NextResponse.json(donations);
}
