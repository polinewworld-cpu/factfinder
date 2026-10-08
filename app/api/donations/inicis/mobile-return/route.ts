import { NextRequest, NextResponse } from 'next/server';
import { isInicisUrl, mobileApprove } from '@/lib/inicis';
import { markDonationFailed, markDonationPaid, resultUrl } from '@/lib/donationPayment';

// 모바일 결제 인증결과 수신(P_NEXT_URL) → 승인요청 → 후원 기록 확정 → 결과 화면으로 이동 (2026-10-08)
// 결제창에서 브라우저 전체가 이 주소로 POST 되므로 303으로 결과 페이지에 보낸다.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const get = (k: string) => (form.get(k) as string | null) ?? null;
  const oid = get('P_NOTI'); // 결제 요청 때 P_NOTI에 주문번호를 실어 보냄
  const go = (url: string) => NextResponse.redirect(url, 303);

  if (get('P_STATUS') !== '00') {
    await markDonationFailed(oid);
    return go(resultUrl(false, { message: get('P_RMESG1') ?? '결제가 취소되었습니다' }));
  }
  const reqUrl = get('P_REQ_URL');
  const tid = get('P_TID');
  if (!oid || !tid || !isInicisUrl(reqUrl, get('idc_name'), 'mobile')) {
    await markDonationFailed(oid);
    return go(resultUrl(false, { message: '결제 승인 주소 검증에 실패했습니다' }));
  }

  try {
    const r = await mobileApprove(reqUrl!, tid);
    if (r.P_STATUS !== '00' || r.P_OID !== oid) {
      await markDonationFailed(oid);
      return go(resultUrl(false, { message: r.P_RMESG1 || '결제 승인에 실패했습니다' }));
    }
    const amount = Number(r.P_AMT);
    const saved = await markDonationPaid(oid, { tid: r.P_TID || tid, amount, payMethod: r.P_TYPE });
    if (!saved.ok) {
      await markDonationFailed(oid);
      return go(resultUrl(false, { message: `${saved.reason} — 결제는 고객센터로 문의해주세요` }));
    }
    return go(resultUrl(true, { amount }));
  } catch {
    await markDonationFailed(oid);
    return go(resultUrl(false, { message: '결제 처리 중 오류가 발생했습니다' }));
  }
}
