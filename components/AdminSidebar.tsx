'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { AdminSidebarToggle, useAdminNav } from './AdminNav';
import { AD_TABS, PEOPLE_TABS, tabActive, type AdminTab } from './AdminTabs';

type NavItem = { href: string; label: string; group?: AdminTab[] };

// 관리자 메뉴 — 전부 플랫 링크 (2026-09-11: 불필요한 '콘텐츠' 그룹 제거, 그룹 아코디언 구조 폐지)
// 2026-10-09: 배너·줄광고·애드센스 → "광고 관리", 기자·신청·옛 기자·회원 → "회원/기자관리" 한 칸 + 화면 안 탭(AdminTabs).
// "옛 사진 옮기기"(/admin/legacy-images)는 당분간 메뉴에서 숨김 — 주소로는 그대로 열림.
const NAV: NavItem[] = [
  { href: '/admin', label: '대시보드' },
  { href: '/admin/trends', label: '오진실 기자' }, // 매체 동향·기사 아이디어 (2026-10-09 방문 분석에서 분리, 10-10 '동향 보고' → 오진실 기자)
  { href: '/admin/foreign-news', label: '김정신 특파원' }, // 한국 관련 영미 외신 보고, 하루 3번 (2026-10-10)
  { href: '/admin/analytics', label: '방문 분석' }, // GA 자동 분석 (2026-10-08)
  { href: '/write', label: '기사 작성' },
  { href: '/admin/articles', label: '전체 기사' },
  { href: '/admin/pending', label: '승인 대기함' },
  { href: '/admin/photo-bank', label: '사진 뱅크' }, // 2026-10-09 사진 뱅크 v0.1
  { href: '/admin/banners', label: '광고 관리', group: AD_TABS },
  { href: '/admin/members?role=REPORTER', label: '회원/기자관리', group: PEOPLE_TABS },
  { href: '/admin/donations', label: '후원내역' },
  { href: '/admin/newsletter', label: '뉴스레터 관리' },
];

function isActive(item: NavItem, pathname: string | null, role: string | null) {
  if (!pathname) return false;
  if (item.group) return item.group.some((t) => tabActive(t.href, pathname, role));
  const path = item.href;
  if (path === '/admin') return pathname === '/admin';
  return pathname === path || pathname.startsWith(`${path}/`);
}

// 기자·논설위원에게 보이는 메뉴 (2026-10-09)
const WRITER_NAV = ['/admin/trends', '/admin/foreign-news', '/write', '/admin/photo-bank'];

export default function AdminSidebar({ isChief = true }: { isChief?: boolean }) {
  const pathname = usePathname();
  const role = useSearchParams().get('role');
  const { open } = useAdminNav();

  return (
    <nav className={`admin-sidebar shrink-0 py-8 ${open ? 'w-40' : 'w-10'}`} aria-label="관리자 메뉴">
      <div className="mb-4 flex items-center">
        <AdminSidebarToggle />
        {open ? <p className="m-0 text-sm font-semibold text-gray-700">{isChief ? '관리자' : '편집실'}</p> : null}
      </div>
      {open ? (
        <div className="space-y-1">
          {NAV.filter((item) => isChief || WRITER_NAV.includes(item.href)).map((item) => {
            const active = isActive(item, pathname, role);
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
      ) : null}
    </nav>
  );
}
