import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { WRITER_ROLES } from '@/lib/roles';
import { allowRequest, clientIp } from '@/lib/rateLimit';
import { inicisKeyStatus, mobilePayParams, newOrderId, pcPayParams } from '@/lib/inicis';

// 후원 금액은 5종 고정 (2026-10-08 사장님 확정) — components/DonateForm.tsx의 PRESETS와 같은 값
const DONATION_AMOUNTS = [3000, 5000, 10000, 20000, 30000];

// 후원 신청 — 2026-10-08부터 정기(매월) 개념 없이 한 번 결제하는 일시 후원. 신청할 때마다 Donation 1건.
// POST는 결제 대기(PENDING) 건을 만들고 이니시스 결제창 요청값을 돌려준다 → 결제 승인은 /api/donations/inicis/* 에서 ACTIVE로 확정.
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

  if (!inicisKeyStatus().matches) {
    return NextResponse.json({ error: '결제 준비 중입니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }
  const { amount, reporterId, phone, name, mobile, articleId } = await req.json();
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

  // 어느 기사에서 후원했는지 — 관리자 후원내역의 기사 링크용. 없는 기사면 무시
  const article = typeof articleId === 'string' && articleId
    ? await prisma.article.findUnique({ where: { id: articleId }, select: { id: true } })
    : null;

  // 결제창만 열고 끝난 지 하루 넘은 대기 건은 실패로 정리 — 후원할 때마다 가볍게 같이 처리 (2026-10-08)
  await prisma.donation.updateMany({
    where: { status: 'PENDING', startedAt: { lt: new Date(Date.now() - 24 * 3600_000) } },
    data: { status: 'FAILED' },
  });

  const oid = newOrderId();
  await prisma.donation.create({
    data: {
      userId: user?.id ?? null, donorName, amount: amt, phone: cleanPhone, reporterId: reporterId || null,
      status: 'PENDING', oid, articleId: article?.id ?? null,
    },
  });

  const order = { oid, amount: amt, name: donorName, phone: cleanPhone };
  return NextResponse.json(
    mobile
      ? { mode: 'mobile', action: 'https://mobile.inicis.com/smart/payment/', fields: mobilePayParams(order) }
      : { mode: 'pc', fields: pcPayParams(order) },
    { status: 201 },
  );
}
