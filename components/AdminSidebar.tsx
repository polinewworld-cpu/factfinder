'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { AdminSidebarToggle, useAdminNav } from './AdminNav';
import { AD_TABS, PEOPLE_TABS, tabActive, type AdminTab } from './AdminTabs';
import { LogoMark } from './icons';
import { closeOnBackdrop } from '@/lib/backdrop';

type IconKey = 'home' | 'user' | 'globe' | 'chart' | 'pen' | 'list' | 'inbox' | 'image' | 'ad' | 'users' | 'heart' | 'mail';
type NavItem = { href: string; label: string; icon: IconKey; group?: AdminTab[] };
type Section = { title: string; items: NavItem[] };

// 관리자 메뉴 — 정글2처럼 묶음 제목(작은 회색 글씨) 아래 항목을 늘어놓는 구조 (2026-10-10)
// 좁은 화면(폰)에서는 위쪽 막대의 햄버거 버튼을 누르면 왼쪽에서 서랍으로 나오고, 넓은 화면에서는 기존처럼 왼쪽에 고정.
// 2026-10-09: 배너·줄광고·애드센스 → "광고 관리", 기자·신청·옛 기자·회원 → "회원/기자관리" 한 칸 + 화면 안 탭(AdminTabs).
// "옛 사진 옮기기"(/admin/legacy-images)는 당분간 메뉴에서 숨김 — 주소로는 그대로 열림.
const SECTIONS: Section[] = [
  {
    title: '편집실',
    items: [
      { href: '/admin', label: '대시보드', icon: 'home' },
      { href: '/admin/trends', label: '오진실 기자', icon: 'user' }, // 매체 동향·기사 아이디어 (10-10 '동향 보고' → 오진실 기자)
      { href: '/admin/foreign-news', label: '김정신 특파원', icon: 'globe' }, // 한국 관련 영미 외신 보고, 하루 3번 (2026-10-10)
      { href: '/admin/analytics', label: '방문 분석', icon: 'chart' }, // GA 자동 분석 (2026-10-08)
    ],
  },
  {
    title: '콘텐츠',
    items: [
      { href: '/write', label: '기사 작성', icon: 'pen' },
      { href: '/admin/articles', label: '전체 기사', icon: 'list' },
      { href: '/admin/pending', label: '승인 대기함', icon: 'inbox' },
      { href: '/admin/photo-bank', label: '사진 뱅크', icon: 'image' }, // 2026-10-09 사진 뱅크 v0.1
    ],
  },
  {
    title: '운영',
    items: [
      { href: '/admin/banners', label: '광고 관리', icon: 'ad', group: AD_TABS },
      { href: '/admin/members?role=REPORTER', label: '회원/기자관리', icon: 'users', group: PEOPLE_TABS },
      { href: '/admin/donations', label: '후원내역', icon: 'heart' },
      { href: '/admin/newsletter', label: '뉴스레터 관리', icon: 'mail' },
    ],
  },
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

const ICON_PATHS: Record<IconKey, string> = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  globe: 'M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  pen: 'M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  inbox: 'M4 13l2-8h12l2 8v6H4v-6zM4 13h5l1 2h4l1-2h5',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01',
  ad: 'M4 10v4l12 5V5L4 10zM16 9a3 3 0 010 6',
  users: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2 20a7 7 0 0114 0M17 11a3 3 0 100-6M22 20a6 6 0 00-4-5.6',
  heart: 'M12 20s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 9c0 6-8 11-8 11z',
  mail: 'M3 6h18v12H3zM3 7l9 7 9-7',
};

function Icon({ k }: { k: IconKey }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[k]} />
    </svg>
  );
}

type Me = { name?: string | null; email?: string | null; image?: string | null };

export default function AdminSidebar({ isChief = true, me }: { isChief?: boolean; me?: Me }) {
  const pathname = usePathname();
  const role = useSearchParams().get('role');
  const { open } = useAdminNav();
  const [drawer, setDrawer] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  const sections = SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => isChief || WRITER_NAV.includes(i.href)) })).filter((s) => s.items.length);
  const all = sections.flatMap((s) => s.items);
  const current = all.find((i) => isActive(i, pathname, role));

  // 다른 화면으로 이동하면 서랍을 닫고, 서랍이 열려 있는 동안 뒤 화면이 스크롤되지 않게 / Esc로 닫기
  useEffect(() => setDrawer(false), [pathname, role]);
  useEffect(() => {
    if (!drawer) return;
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(t);
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [drawer]);

  const clock = now
    ? `${new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(now)}  ${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(now)}`
    : '';

  return (
    <>
      {/* ── 폰: 위쪽 막대(햄버거 + 현재 화면 이름) + 왼쪽에서 나오는 서랍 ── */}
      <div className="md:hidden">
        <div className="admin-mobilebar flex items-center gap-3 py-2">
          <button
            type="button"
            aria-label="관리자 메뉴 열기"
            onClick={() => setDrawer(true)}
            className="flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-[5px] rounded-xl border bg-white shadow-sm"
          >
            <span className="block h-[3px] w-6 rounded bg-[#4285f4]" />
            <span className="block h-[3px] w-6 rounded bg-[#ea4335]" />
            <span className="block h-[3px] w-6 rounded bg-[#fbbc05]" />
          </button>
          <span className="text-base font-bold text-gray-900">{current?.label ?? (isChief ? '관리자' : '편집실')}</span>
        </div>

        {drawer && (
          <div className="fixed inset-0 z-50 flex">
            <aside className="flex h-full w-[82%] max-w-[330px] flex-col overflow-y-auto bg-white shadow-2xl" style={{ background: '#fff' }} role="dialog" aria-label="관리자 메뉴">
              <div className="flex items-center justify-between px-5 pb-3 pt-5">
                <a href="/" aria-label="팩트파인더 홈" className="block w-28">
                  <LogoMark />
                </a>
                <button type="button" aria-label="메뉴 닫기" onClick={() => setDrawer(false)} className="flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none text-gray-500">
                  ×
                </button>
              </div>
              {clock && <div className="mx-5 mb-2 rounded-2xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 tabular-nums">{clock}</div>}

              <div className="flex-1">
                {sections.map((s) => (
                  <div key={s.title} className="border-t border-gray-100 px-3 py-3 first:border-t-0">
                    <p className="m-0 px-3 pb-1 text-[12px] font-semibold text-gray-400">{s.title}</p>
                    {s.items.map((item) => {
                      const active = isActive(item, pathname, role);
                      return (
                        <a
                          key={item.href}
                          href={item.href}
                          className="mb-1 flex items-center gap-4 rounded-2xl px-3 py-3 text-[15px] font-semibold"
                          style={{ background: active ? '#d6e4e2' : '#fff', color: active ? '#0d4f55' : '#1f3033', boxShadow: active ? 'none' : '0 1px 6px rgba(0,0,0,0.05)' }}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                            <Icon k={item.icon} />
                          </span>
                          {item.label}
                        </a>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* 맨 아래: 내 정보 + 로그아웃 */}
              <div className="border-t border-gray-100 px-5 py-4">
                {me && (
                  <div className="mb-3 flex items-center gap-3">
                    {me.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={me.image} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-500">{(me.name ?? '?').slice(0, 1)}</span>
                    )}
                    <div className="min-w-0">
                      <p className="m-0 truncate text-[15px] font-bold text-gray-900">{me.name}</p>
                      <p className="m-0 truncate text-xs text-gray-500">{me.email}</p>
                    </div>
                  </div>
                )}
                <a href="/api/auth/signout" className="block rounded-xl border border-red-200 py-2.5 text-center text-sm font-semibold text-red-500">
                  로그아웃
                </a>
              </div>
            </aside>
            <div className="flex-1 bg-black/45" {...closeOnBackdrop(() => setDrawer(false))} />
          </div>
        )}
      </div>

      {/* ── 넓은 화면: 기존처럼 왼쪽 고정 메뉴(묶음 제목 포함) ── */}
      <nav className={`admin-sidebar hidden shrink-0 py-8 md:block ${open ? 'w-40' : 'w-10'}`} aria-label="관리자 메뉴">
        <div className="mb-4 flex items-center">
          <AdminSidebarToggle />
          {open ? <p className="m-0 text-sm font-semibold text-gray-700">{isChief ? '관리자' : '편집실'}</p> : null}
        </div>
        {open ? (
          <div>
            {sections.map((s) => (
              <div key={s.title} className="mb-3">
                <p className="m-0 px-3 pb-1 text-[11px] font-semibold text-gray-400">{s.title}</p>
                <div className="space-y-1">
                  {s.items.map((item) => {
                    const active = isActive(item, pathname, role);
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        className={`block rounded-lg px-3 py-2 text-sm font-semibold ${active ? 'bg-brand text-white' : 'text-gray-700 hover:bg-brand/10 hover:text-brand'}`}
                      >
                        {item.label}
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </nav>
    </>
  );
}
