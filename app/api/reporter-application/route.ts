import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WRITER_ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 독자가 "기자로 신청하기" — 프로필(닉네임/사진/자기소개/SNS)은 /api/me로 이미 저장돼 있어야 함
// 신청 시점엔 닉네임(필명 역할 겸용)만 필수로 확인 (기능정의서 3.2.1)
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const full = await prisma.user.findUnique({ where: { id: user.id } });
  if (!full) return NextResponse.json({ error: '회원 정보를 찾을 수 없습니다' }, { status: 404 });

  if ((WRITER_ROLES as readonly string[]).includes(full.role)) {
    return NextResponse.json({ error: '이미 기자 이상 등급입니다' }, { status: 400 });
  }
  if (full.reporterApplicationStatus === 'PENDING') {
    return NextResponse.json({ error: '이미 기자 신청 중입니다' }, { status: 400 });
  }
  if (!full.nickname?.trim()) {
    return NextResponse.json({ error: '먼저 프로필에서 닉네임을 저장해주세요' }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { reporterApplicationStatus: 'PENDING' },
  });
  return NextResponse.json(updated);
}

// 신청 취소 (승인대기 중일 때만)
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const full = await prisma.user.findUnique({ where: { id: user.id } });
  if (full?.reporterApplicationStatus !== 'PENDING') {
    return NextResponse.json({ error: '취소할 신청이 없습니다' }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { reporterApplicationStatus: null },
  });
  return NextResponse.json(updated);
}
