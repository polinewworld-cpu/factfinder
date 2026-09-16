import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { ROLES, WRITER_ROLES } from '@/lib/roles';

// 정기후원 신청 — PG 계약정보 미확정 상태라 실제 카드결제는 없음(결제 없이 구독 상태만 생성).
// 카드 등록/결제 연동은 KG이니시스 등 계약 확정 시 이 라우트 안에서만 교체하면 되도록 분리해둠.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const active = await prisma.donation.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
    include: { reporter: { select: { name: true, nickname: true } } },
    orderBy: { startedAt: 'desc' },
  });
  return NextResponse.json(active);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const { amount, reporterId, phone } = await req.json();
  const amt = Number(amount);
  if (!amt || amt < 1000) {
    return NextResponse.json({ error: '최소 후원금액은 1,000원입니다' }, { status: 400 });
  }
  const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
  if (!cleanPhone) {
    return NextResponse.json({ error: '연락처(전화번호)를 입력해주세요' }, { status: 400 });
  }

  // 특정 기자를 지정한 후원인 경우 실제로 기자 등급 회원이 맞는지 확인 (기능정의서 7)
  if (reporterId) {
    const target = await prisma.user.findUnique({ where: { id: reporterId } });
    if (!target || !(WRITER_ROLES as readonly string[]).includes(target.role)) {
      return NextResponse.json({ error: '유효하지 않은 기자입니다' }, { status: 400 });
    }
  }

  const existing = await prisma.donation.findFirst({ where: { userId: user.id, status: 'ACTIVE' } });
  if (existing) {
    return NextResponse.json({ error: '이미 진행중인 정기후원이 있습니다' }, { status: 400 });
  }

  const [donation] = await prisma.$transaction([
    prisma.donation.create({ data: { userId: user.id, amount: amt, phone: cleanPhone, reporterId: reporterId || null } }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        isDonor: true,
        role: user.role === ROLES.READER ? ROLES.DONOR_READER : undefined,
      },
    }),
  ]);

  return NextResponse.json(donation, { status: 201 });
}
