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

// 2026-10-10 기자 종류 재정의: 기자(로그인) · 비회원 기자 · 돌아올 기자 · 유령기자
export const PEOPLE_TABS: AdminTab[] = [
  { href: '/admin/members?role=REPORTER', label: '기자' },
  { href: '/admin/ghost-writers', label: '비회원 기자' }, // 원고를 받아 편집장이 올려 주는 필자
  { href: '/admin/legacy-reporters', label: '돌아올 기자' }, // 가입하면 옛 기사와 연결
  { href: '/admin/ghost-writers?kind=GHOST', label: '유령기자' }, // 끊어진 기자 — 지난 기사에 이름만
  { href: '/admin/reporter-applications', label: '기자 신청 대기' },
  { href: '/admin/members', label: '회원관리' },
];

// 같은 경로라도 ?role=·?kind= 값이 다르면 다른 탭(기자 vs 회원관리, 비회원 기자 vs 유령기자)
export function tabActive(href: string, pathname: string | null, role: string | null, kind: string | null = null) {
  const [path, query] = href.split('?');
  if (pathname !== path) return false;
  const q = new URLSearchParams(query);
  return (q.get('role') ?? null) === role && (q.get('kind') ?? null) === kind;
}

export default function AdminTabs({ title, tabs }: { title: string; tabs: AdminTab[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const role = params.get('role');
  const kind = params.get('kind');
  return (
    <div className="mb-6">
      <h1 className="text-xl font-bold text-gray-900 mb-3">{title}</h1>
      <nav className="flex flex-wrap gap-1 border-b" aria-label={`${title} 탭`}>
        {tabs.map((t) => {
          const active = tabActive(t.href, pathname, role, kind);
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
