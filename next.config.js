// 옛 사이트(factfinder.tv, 다다미디어 PHP CMS) 주소 → 새 주소 영구 이동 (2026-10-08)
// 옛 기사 번호(/article/3377)는 app/article/[id]/page.tsx가 legacyId로 찾아 새 기사로 한 번 더 이동시킨다.
// 옛 카테고리(list.php?mcode=...)는 새 메뉴 체계 확정 전이라 일단 홈으로 보냄.
const legacyRedirects = [
  // 기사: /news/view.php?idx=N (정본), /news/N
  { source: '/news/view.php', has: [{ type: 'query', key: 'idx', value: '(?<idx>\\d+)' }], destination: '/article/:idx' },
  { source: '/news/:idx(\\d+)', destination: '/article/:idx' },
  { source: '/m/view.php', has: [{ type: 'query', key: 'idx', value: '(?<idx>\\d+)' }], destination: '/article/:idx' },
  // 목록·검색·모바일 홈·회원
  // 옛 '후원하기' 메뉴(mcode 두 개) → 새 '후원하기' 카테고리 (2026-10-08)
  { source: '/news/list.php', has: [{ type: 'query', key: 'mcode', value: 'm878ope' }], destination: '/?category=%ED%9B%84%EC%9B%90%ED%95%98%EA%B8%B0' },
  { source: '/news/list.php', has: [{ type: 'query', key: 'mcode', value: 'm889qdv' }], destination: '/?category=%ED%9B%84%EC%9B%90%ED%95%98%EA%B8%B0' },
  { source: '/news/list.php', destination: '/' },
  { source: '/news/index.php', destination: '/' },
  { source: '/news/search.php', destination: '/search' },
  { source: '/m', destination: '/' },
  { source: '/m/:path*', destination: '/' },
  { source: '/bbs/:path*', destination: '/' },
  { source: '/index.php', destination: '/' },
  // 회사 정보 페이지
  { source: '/company/introduce.php', destination: '/company/introduce' },
  { source: '/company/customer.php', has: [{ type: 'query', key: 'gubun', value: '2' }], destination: '/company/report' },
  { source: '/company/customer.php', has: [{ type: 'query', key: 'gubun', value: '3' }], destination: '/company/partnership' },
  { source: '/company/customer.php', destination: '/company/report' },
  { source: '/company/policy.php', destination: '/company/privacy' },
  { source: '/company/protection.php', destination: '/company/youth-protection' },
  { source: '/company/deny.php', destination: '/company/mail-refusal' },
  // RSS
  { source: '/company/rss.php', destination: '/rss.xml' },
  { source: '/rss_view.php', destination: '/rss.xml' },
  { source: '/rss.php', destination: '/rss.xml' },
  // 후원(옛 이니시스 결제 페이지)
  { source: '/pg_inicis/:path*', destination: '/donate' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return legacyRedirects.map((r) => ({ ...r, permanent: true }));
  },
};
module.exports = nextConfig;
