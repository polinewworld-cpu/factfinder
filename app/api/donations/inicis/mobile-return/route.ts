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

  // 승인 요청을 보낸 뒤엔 결과를 모르는 채로 "실패" 처리하지 않음 — 모바일 쪽엔 망취소 처리가 없어서,
  // 승인은 났는데 기록만 실패로 남으면 돈만 빠지게 됨 (2026-10-09). 대신 로그에 주문번호·거래번호를 남겨 대조 가능하게.
  let r: Record<string, string>;
  try {
    r = await mobileApprove(reqUrl!, tid);
  } catch (e) {
    console.error('[inicis] 모바일 승인 응답 없음 — 결제 여부 확인 필요', oid, tid, e);
    return go(resultUrl(false, { message: '결제 결과를 확인하지 못했습니다. 결제가 됐다면 고객센터로 문의해주세요' }));
  }
  if (r.P_STATUS !== '00' || r.P_OID !== oid) {
    await markDonationFailed(oid);
    return go(resultUrl(false, { message: r.P_RMESG1 || '결제 승인에 실패했습니다' }));
  }
  const amount = Number(r.P_AMT);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const saved = await markDonationPaid(oid, { tid: r.P_TID || tid, amount, payMethod: r.P_TYPE });
      if (saved.ok) {
        console.log('[inicis] 모바일 결제 완료', oid, r.P_TID || tid, amount);
        return go(resultUrl(true, { amount }));
      }
      console.error('[inicis] 모바일 승인됐으나 기록 거부 — 확인 필요', oid, r.P_TID || tid, amount, saved.reason);
      return go(resultUrl(false, { message: `${saved.reason} — 결제는 고객센터로 문의해주세요` }));
    } catch (e) {
      console.error('[inicis] 모바일 승인됐으나 기록 실패 — 재시도', attempt + 1, oid, r.P_TID || tid, e);
      await new Promise((res) => setTimeout(res, 1000));
    }
  }
  return go(resultUrl(false, { message: '결제는 승인됐으나 기록에 실패했습니다. 고객센터로 문의해주세요' }));
}
