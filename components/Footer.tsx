// 팩트파인더 실사이트(factfinder.tv) footer 그대로 이식 — 하단 네비게이션 6개 링크 + 등록정보/발행정보 블록 (2026-09-12 신설)
// 발행일자는 실사이트처럼 오늘 날짜(KST)로 매일 자동 갱신됨.
function todayKr() {
  const now = new Date();
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, '0');
  const d = String(kst.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const FOOTER_LINKS = [
  { label: '회사소개', href: '/company/introduce' },
  { label: '기사제보', href: '/company/report' },
  { label: '광고 및 제휴문의', href: '/company/partnership' },
  { label: '개인정보취급방침', href: '/company/privacy' },
  { label: '청소년보호정책', href: '/company/youth-protection' },
  { label: '메일수집거부', href: '/company/mail-refusal' },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <nav className="footer-nav" aria-label="회사 정보">
          {FOOTER_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="footer-info">
          <strong>팩트파인더</strong>
          <div className="footer-info-grid">
            <span>등록번호 서울, 아55647</span>
            <span>등록일 2021-04-08</span>
            <span>발행일자 {todayKr()}</span>
            <span>발행인 김남훈</span>
            <span>편집인 윤주협</span>
            <span>청소년보호책임자 윤주협</span>
            <span>연락처 070-8028-2438</span>
            <span>이메일 polinewworld@gmail.com</span>
            <span>주소 서울 마포구 와우산로32길 41 명인빌딩 B1</span>
          </div>
          <p className="footer-copyright">팩트파인더 © www.factfinder.tv All rights reserved.</p>
          <p className="footer-copyright">
            팩트파인더의 모든 콘텐츠(기사 등)는 저작권법의 보호를 받은바, 무단 전재, 복사, 배포 등을 금합니다.
          </p>
        </div>
      </div>
    </footer>
  );
}
