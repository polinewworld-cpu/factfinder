import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { ROLES } from '@/lib/roles';

// 정기후원 신청 — PG 계약정보 미확정 상태라 실제 카드결제는 없음(결제 없이 구독 상태만 생성).
// 카드 등록/결제 연동은 KG이니시스 등 계약 확정 시 이 라우트 안에서만 교체하면 되도록 분리해둠.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const active = await prisma.donation.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
    orderBy: { startedAt: 'desc' },
  });
  return NextResponse.json(active);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const { amount } = await req.json();
  const amt = Number(amount);
  if (!amt || amt < 1000) {
    return NextResponse.json({ error: '최소 후원금액은 1,000원입니다' }, { status: 400 });
  }

  const existing = await prisma.donation.findFirst({ where: { userId: user.id, status: 'ACTIVE' } });
  if (existing) {
    return NextResponse.json({ error: '이미 진행중인 정기후원이 있습니다' }, { status: 400 });
  }

  const [donation] = await prisma.$transaction([
    prisma.donation.create({ data: { userId: user.id, amount: amt } }),
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
