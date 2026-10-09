import { NextRequest } from 'next/server';
import { isInicisUrl, pcApprove, pcNetCancel } from '@/lib/inicis';
import { markDonationFailed, markDonationPaid, resultUrl } from '@/lib/donationPayment';
import { prisma } from '@/lib/prisma';

// PC 결제창(INIStdPay) 인증결과 수신(returnUrl) → 승인요청 → 후원 기록 확정 (2026-10-08)
// 이 응답은 결제창 레이어(iframe) 안에서 열리므로, 결과 화면으로는 바깥 창(top)을 이동시킨다.
function goTop(url: string) {
  const html = `<!doctype html><meta charset="utf-8"><script>(window.top||window).location.href=${JSON.stringify(url)};</script>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const get = (k: string) => (form.get(k) as string | null) ?? null;
  const oid = get('orderNumber');

  if (get('resultCode') !== '0000') {
    await markDonationFailed(oid);
    return goTop(resultUrl(false, { message: get('resultMsg') ?? '결제가 취소되었습니다' }));
  }

  const authUrl = get('authUrl');
  const netCancelUrl = get('netCancelUrl');
  const authToken = get('authToken') ?? '';
  const idc = get('idc_name');
  if (!oid || !isInicisUrl(authUrl, idc, 'stdpay')) {
    await markDonationFailed(oid);
    return goTop(resultUrl(false, { message: '결제 승인 주소 검증에 실패했습니다' }));
  }

  const donation = await prisma.donation.findUnique({ where: { oid } });
  if (!donation) return goTop(resultUrl(false, { message: '주문 정보를 찾을 수 없습니다' }));

  try {
    const r = await pcApprove(authUrl!, authToken, donation.amount);
    if (r.resultCode !== '0000') {
      await markDonationFailed(oid);
      return goTop(resultUrl(false, { message: r.resultMsg ?? '결제 승인에 실패했습니다' }));
    }
    // 승인 응답의 주문번호가 이 주문과 다르면(다른 결제의 인증값을 끼워 넣은 경우) 기록하지 않고 망취소 (2026-10-09)
    if (r.MOID && r.MOID !== oid) throw new Error('주문번호가 일치하지 않습니다');
    const saved = await markDonationPaid(oid, { tid: r.tid, amount: Number(r.TotPrice), payMethod: r.payMethod });
    if (!saved.ok) throw new Error(saved.reason);
    console.log('[inicis] PC 결제 완료', oid, r.tid, donation.amount);
    return goTop(resultUrl(true, { amount: donation.amount }));
  } catch (e) {
    console.error('[inicis] PC 승인 처리 실패 → 망취소', oid, e);
    // 승인은 났는데 기록 실패 등 예외 → 규격대로 망취소(10분 이내)해서 돈만 빠져나가는 일이 없게
    if (isInicisUrl(netCancelUrl, idc, 'stdpay')) await pcNetCancel(netCancelUrl!, authToken, donation.amount);
    await markDonationFailed(oid);
    return goTop(resultUrl(false, { message: e instanceof Error ? e.message : '결제 처리 중 오류가 발생했습니다' }));
  }
}
