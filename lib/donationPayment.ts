import { prisma } from '@/lib/prisma';
import { SITE_URL } from '@/lib/siteTags';

// 이니시스 승인 결과를 후원 기록에 반영 (PC·모바일 공통, 2026-10-08)
// 주문번호(oid)로 결제 대기(PENDING) 건을 찾아, 승인 금액이 신청 금액과 같을 때만 결제 완료(ACTIVE)로 바꾼다.
export async function markDonationPaid(oid: string, r: { tid: string; amount: number; payMethod?: string }) {
  const donation = await prisma.donation.findUnique({ where: { oid } });
  if (!donation) return { ok: false as const, reason: '주문 정보를 찾을 수 없습니다' };
  if (donation.status === 'ACTIVE' && donation.tid === r.tid) return { ok: true as const, donation }; // 새로고침 등 중복 수신
  if (donation.amount !== r.amount) return { ok: false as const, reason: '결제 금액이 신청 금액과 다릅니다' };

  // 대기(PENDING)뿐 아니라 실패(FAILED)로 표시된 건도 진짜 승인이 오면 완료로 — 하루 지난 대기 건 자동 정리나
  // 위조된 "취소" 결과 수신으로 FAILED가 된 뒤 승인이 도착하면, 돈은 빠졌는데 기록이 없던 구멍 (2026-10-09).
  // 조건부 updateMany라 같은 주문이 동시에 두 번 들어와도 한 번만 반영된다.
  const { count } = await prisma.donation.updateMany({
    where: { oid, status: { in: ['PENDING', 'FAILED'] } },
    data: { status: 'ACTIVE', tid: r.tid, payMethod: r.payMethod ?? null, paidAt: new Date(), startedAt: new Date() },
  });
  if (count === 0) {
    const now = await prisma.donation.findUnique({ where: { oid } });
    if (now?.status === 'ACTIVE' && now.tid === r.tid) return { ok: true as const, donation: now };
    return { ok: false as const, reason: '이미 처리된 주문입니다' };
  }
  // 후원 여부는 isDonor 플래그로만 표시 — 회원 등급(role)에는 영향 없음 (2026-09-22: 회원/후원회원 구별 폐지)
  if (donation.userId) await prisma.user.update({ where: { id: donation.userId }, data: { isDonor: true } });
  return { ok: true as const, donation: { ...donation, status: 'ACTIVE' as const, tid: r.tid } };
}

export async function markDonationFailed(oid: string | null) {
  if (!oid) return;
  await prisma.donation.updateMany({ where: { oid, status: 'PENDING' }, data: { status: 'FAILED' } });
}

export function resultUrl(ok: boolean, detail: { amount?: number; message?: string }) {
  const params = new URLSearchParams({ status: ok ? 'ok' : 'fail' });
  if (detail.amount) params.set('amount', String(detail.amount));
  if (detail.message) params.set('message', detail.message.slice(0, 120));
  return `${SITE_URL}/donate/result?${params}`;
}
