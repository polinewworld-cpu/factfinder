import { createHash } from 'crypto';
import { SITE_URL } from '@/lib/siteTags';

// KG이니시스 결제 연동 (2026-10-08) — 옛 사이트와 같은 상점(엠제이연구소, MID factfind38)을 그대로 사용.
// PC: 웹표준결제(INIStdPay) / 모바일: 스마트결제(mobile.inicis.com). 공식 규격: https://manual.inicis.com/pay/stdpay_pc.html
// 비밀값 INICIS_SIGN_KEY는 Render 환경변수에만 있음 — 코드·문서에 절대 적지 말 것.

export const INICIS_MID = process.env.INICIS_MID || 'factfind38';
const signKey = () => process.env.INICIS_SIGN_KEY ?? '';

// 옛 결제 페이지에 공개돼 있던 mKey(= sha256(signKey)) — 넣은 키가 이 상점의 키가 맞는지 확인하는 용도
const EXPECTED_MKEY = '82aaf4c5df5d3b970e4bdb8a48b6bd64d23a05818838ce67bd51f81c8da29bfe';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function inicisKeyStatus() {
  const key = signKey();
  return { configured: !!key, matches: !!key && (INICIS_MID !== 'factfind38' || sha256(key) === EXPECTED_MKEY) };
}

export const GOOD_NAME = '팩트파인더 원고료 후원';

export function newOrderId() {
  return `FF${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

const digitsAndHyphen = (s: string) => s.replace(/[^0-9-]/g, '').slice(0, 20);

// PC 결제창(INIStdPay) 요청값 — STEP1
export function pcPayParams(d: { oid: string; amount: number; name: string; phone: string }) {
  const timestamp = String(Date.now());
  const price = String(d.amount);
  return {
    version: '1.0',
    gopaymethod: 'Card:DirectBank', // 옛 사이트의 가상계좌는 입금통보 처리가 따로 필요해 제외
    mid: INICIS_MID,
    oid: d.oid,
    price,
    timestamp,
    use_chkfake: 'Y',
    signature: sha256(`oid=${d.oid}&price=${price}&timestamp=${timestamp}`),
    verification: sha256(`oid=${d.oid}&price=${price}&signKey=${signKey()}&timestamp=${timestamp}`),
    mKey: sha256(signKey()),
    currency: 'WON',
    goodname: GOOD_NAME,
    buyername: d.name.slice(0, 30),
    buyertel: digitsAndHyphen(d.phone),
    buyeremail: '',
    returnUrl: `${SITE_URL}/api/donations/inicis/return`,
    closeUrl: `${SITE_URL}/api/donations/inicis/close`,
    acceptmethod: 'centerCd(Y)', // IDC센터코드 수신 — 규격상 필수
  };
}

// 모바일 결제 요청값 — mobile.inicis.com/smart/payment/ 로 POST (요청 인코딩 EUC-KR, 결과는 utf8로 받음)
export function mobilePayParams(d: { oid: string; amount: number; name: string; phone: string }) {
  return {
    P_INI_PAYMENT: 'CARD',
    P_MID: INICIS_MID,
    P_OID: d.oid,
    P_AMT: String(d.amount),
    P_GOODS: GOOD_NAME,
    P_UNAME: d.name.slice(0, 30),
    P_MOBILE: digitsAndHyphen(d.phone).slice(0, 15),
    P_NEXT_URL: `${SITE_URL}/api/donations/inicis/mobile-return`,
    P_NOTI: d.oid,
    P_CHARSET: 'utf8',
    P_RESERVED: 'centerCd=Y', // IDC센터코드 수신 — 규격상 필수 (금액위변조 hash는 상점 미사용)
  };
}

// 승인요청 URL이 진짜 이니시스 서버인지 IDC센터코드와 대조 (규격상 필수 검증)
const IDC = new Set(['fc', 'ks', 'stg']);
export function isInicisUrl(url: string | null, idc: string | null, kind: 'stdpay' | 'mobile') {
  if (!url || !idc || !IDC.has(idc)) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === `${idc}${kind}.inicis.com`;
  } catch {
    return false;
  }
}

// PC STEP3 승인요청 / 망취소 — 같은 파라미터
function pcAuthBody(authToken: string, price: number) {
  const timestamp = String(Date.now());
  return new URLSearchParams({
    mid: INICIS_MID,
    authToken,
    timestamp,
    signature: sha256(`authToken=${authToken}&timestamp=${timestamp}`),
    verification: sha256(`authToken=${authToken}&signKey=${signKey()}&timestamp=${timestamp}`),
    charset: 'UTF-8',
    format: 'JSON',
    price: String(price),
  });
}

export async function pcApprove(authUrl: string, authToken: string, price: number) {
  const res = await fetch(authUrl, { method: 'POST', body: pcAuthBody(authToken, price) });
  return (await res.json()) as Record<string, string>;
}

export async function pcNetCancel(netCancelUrl: string, authToken: string, price: number) {
  await fetch(netCancelUrl, { method: 'POST', body: pcAuthBody(authToken, price) }).catch(() => {});
}

// 모바일 STEP3 승인요청 — 응답은 "P_STATUS=00&P_TID=..." 형태
export async function mobileApprove(reqUrl: string, tid: string) {
  const res = await fetch(reqUrl, { method: 'POST', body: new URLSearchParams({ P_MID: INICIS_MID, P_TID: tid }) });
  return Object.fromEntries(new URLSearchParams(await res.text()));
}
