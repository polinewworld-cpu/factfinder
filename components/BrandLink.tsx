'use client';

import { usePathname } from 'next/navigation';
import { useAdminNav } from './AdminNav';

// 헤더의 팩트파인더 로고 (2026-10-10) — 일반 화면에서는 홈으로 가는 링크,
// 관리·글쓰기 화면에서는 초록색으로 바뀌어 메뉴 버튼 역할: 폰에서는 메뉴 서랍을 열고 닫고, 넓은 화면에서는 왼쪽 메뉴를 접었다 폅니다.
export default function BrandLink({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { toggle, setDrawer } = useAdminNav();
  const backstage = pathname?.startsWith('/admin') || pathname === '/write';

  if (!backstage) {
    return (
      <a className="brand" href="/" aria-label="팩트파인더 홈">
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      className="brand brand-admin"
      aria-label="관리자 메뉴 열기·닫기"
      title="관리자 메뉴"
      onClick={() => (window.matchMedia('(max-width: 767px)').matches ? setDrawer((v) => !v) : toggle())}
    >
      {children}
    </button>
  );
}
