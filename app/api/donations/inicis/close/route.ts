// PC 결제창(INIStdPay) 닫기(closeUrl) — 이니시스 제공 스크립트로 결제 레이어만 닫는다 (2026-10-08)
const html =
  '<!doctype html><meta charset="utf-8"><script src="https://stdpay.inicis.com/stdjs/INIStdPay_close.js"></script>';

function close() {
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export { close as GET, close as POST };
