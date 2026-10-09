'use client';

import { usePathname, useSearchParams } from 'next/navigation';

// 관리자 메뉴 묶음 탭 (2026-10-09) — 사이드바 한 칸 아래 여러 화면을 탭으로 오간다.
// 각 탭은 원래 주소 그대로라 즐겨찾기·링크가 깨지지 않음.

export type AdminTab = { href: string; label: string };

export const AD_TABS: AdminTab[] = [
  { href: '/admin/banners', label: '배너' },
  { href: '/admin/line-ads', label: '줄광고' },
  { href: '/admin/adsense', label: '애드센스' },
];

export const PEOPLE_TABS: AdminTab[] = [
  { href: '/admin/members?role=REPORTER', label: '기자관리' },
  { href: '/admin/reporter-applications', label: '기자 신청 대기' },
  { href: '/admin/legacy-reporters', label: '옛 기자 연결' },
  { href: '/admin/members', label: '회원관리' },
];

// 같은 경로라도 ?role= 값이 다르면 다른 탭(기자관리 vs 회원관리)
export function tabActive(href: string, pathname: string | null, role: string | null) {
  const [path, query] = href.split('?');
  if (pathname !== path) return false;
  return (new URLSearchParams(query).get('role') ?? null) === role;
}

export default function AdminTabs({ title, tabs }: { title: string; tabs: AdminTab[] }) {
  const pathname = usePathname();
  const role = useSearchParams().get('role');
  return (
    <div className="mb-6">
      <h1 className="text-xl font-bold text-gray-900 mb-3">{title}</h1>
      <nav className="flex flex-wrap gap-1 border-b" aria-label={`${title} 탭`}>
        {tabs.map((t) => {
          const active = tabActive(t.href, pathname, role);
          return (
            <a
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={`px-4 py-2 text-sm -mb-px border-b-2 ${
                active ? 'border-brand text-brand font-bold' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              {t.label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
