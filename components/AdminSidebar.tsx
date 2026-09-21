'use client';

import { usePathname } from 'next/navigation';

type NavItem = { href: string; label: string };

// 관리자 메뉴 — 전부 플랫 링크 (2026-09-11: 불필요한 '콘텐츠' 그룹 제거, 그룹 아코디언 구조 폐지)
const NAV: NavItem[] = [
  { href: '/admin', label: '대시보드' },
  { href: '/write', label: '기사 작성' },
  { href: '/admin/articles', label: '전체 기사' },
  { href: '/admin/pending', label: '승인 대기함' },
  { href: '/admin/banners', label: '배너 관리' },
  { href: '/admin/line-ads', label: '줄광고 관리' },
  { href: '/admin/members', label: '전체 회원' },
  { href: '/admin/members?role=REPORTER', label: '기자관리' },
  { href: '/admin/reporter-applications', label: '기자 신청 대기함' },
  { href: '/admin/donations', label: '전체 후원리스트' },
  { href: '/admin/settlement', label: '후원 정산' },
  { href: '/admin/newsletter', label: '뉴스레터 발송' },
];

function isActive(href: string, pathname: string | null) {
  if (!pathname) return false;
  const path = href.split('?')[0];
  if (path === '/admin') return pathname === '/admin';
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-40 shrink-0 py-8" aria-label="관리자 메뉴">
      <p className="mb-4 px-3 text-xs font-bold uppercase tracking-wide text-gray-400">관리자</p>
      <div className="space-y-1">
        {NAV.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <a
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-semibold ${
                active ? 'bg-brand text-white' : 'text-gray-700 hover:bg-brand/10 hover:text-brand'
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
