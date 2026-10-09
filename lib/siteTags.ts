// 광고·통계·검색엔진 인증 ID — 옛 사이트(factfinder.tv, 다다미디어 CMS)에 있던 값 그대로 이식 (2026-10-08)
// 전부 공개값(페이지 소스에 노출되는 값)이라 코드에 둬도 됨. 계정 소유자: 팩트파인더(polinewworld@gmail.com 쪽)

export const SITE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3411';

// 실제 도메인에서만 광고·통계 스크립트를 켠다 — 테스트 주소(onrender.com, localhost) 방문이 통계·광고에 섞이지 않도록
export const IS_LIVE_DOMAIN = /(^|\.)factfinder\.tv/.test(new URL(SITE_URL).hostname);

// 2026-10-09: 김남훈(파트너) 명의 계정 — factfinder.tv 이미 승인돼 있어 그대로 사용(사장님 결정: 수익 계좌 무관). 사장님 계정 pub-5435039189673790은 예비
export const ADSENSE_CLIENT = 'ca-pub-1922059581667762'; // public/ads.txt와 반드시 같은 값
// 2026-10-08: 사장님 계정에 새로 만든 GA4(계정·속성 "팩트파인더", 속성 번호 558113690)로 교체.
// 옛 사이트의 G-57MDTF7LV5·G-VKYG8L5SWC는 사장님 계정에 없어(다다미디어 쪽 추정) 제거.
export const GA4_IDS = ['G-HBX6WJSHM5'];
export const NAVER_ANALYTICS_ID = '120fe082e5228c0';
export const CLARITY_IDS = ['ob6v080n9r', 's439iuqb0u'];

export const GOOGLE_SITE_VERIFICATION = [
  'csNWA-XrwtIWhMmPPBbLD_60H18EqrYa0xPZbdOqT1E',
  'Er9NILcRw_2WGqPbob7K2erYxgqCU5V6Sx_lE_0bCTc',
];
export const NAVER_SITE_VERIFICATION = '41f644099ca1cdc032fdc063aeb5eab72ef48373';
