import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { WRITER_ROLES } from '@/lib/roles';
import { allowRequest, clientIp } from '@/lib/rateLimit';

// 후원 금액은 5종 고정 (2026-10-08 사장님 확정) — components/DonateForm.tsx의 PRESETS와 같은 값
const DONATION_AMOUNTS = [3000, 5000, 10000, 20000, 30000];

// 후원 신청 — 2026-10-08부터 정기(매월) 개념 없이 한 번 결제하는 일시 후원. 신청할 때마다 Donation 1건.
// KG이니시스(MID factfind38) 결제 연동 전이라 아직 실제 결제는 없음 — 연동 시 이 라우트 안에서 교체.
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
  // 로그인 없이도 후원 가능(옛 사이트와 동일) — 로그인 상태면 계정에 연결
  if (!allowRequest(`donation_${clientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: '잠시 후 다시 시도해주세요' }, { status: 429 });
  }
  const user = await getCurrentUser();

  const { amount, reporterId, phone, name } = await req.json();
  const amt = Number(amount);
  if (!DONATION_AMOUNTS.includes(amt)) {
    return NextResponse.json({ error: '후원 금액을 선택해주세요' }, { status: 400 });
  }
  const donorName = typeof name === 'string' ? name.trim().slice(0, 50) : '';
  if (!donorName) {
    return NextResponse.json({ error: '후원자 이름을 입력해주세요' }, { status: 400 });
  }
  const cleanPhone = typeof phone === 'string' ? phone.trim().slice(0, 30) : '';
  if (!cleanPhone) {
    return NextResponse.json({ error: '후원자 연락처를 입력해주세요' }, { status: 400 });
  }

  // 특정 기자를 지정한 후원인 경우 실제로 기자 등급 회원이 맞는지 확인 (기능정의서 7)
  if (reporterId) {
    const target = await prisma.user.findUnique({ where: { id: reporterId } });
    if (!target || !(WRITER_ROLES as readonly string[]).includes(target.role)) {
      return NextResponse.json({ error: '유효하지 않은 기자입니다' }, { status: 400 });
    }
  }

  const donation = await prisma.donation.create({
    data: { userId: user?.id ?? null, donorName, amount: amt, phone: cleanPhone, reporterId: reporterId || null },
  });
  // 후원 여부는 isDonor 플래그로만 표시 — 회원 등급(role)에는 영향 없음 (2026-09-22: 회원/후원회원 구별 폐지)
  if (user) await prisma.user.update({ where: { id: user.id }, data: { isDonor: true } });

  return NextResponse.json(donation, { status: 201 });
}
