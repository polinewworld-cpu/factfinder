'use client';

import { useEffect, useState } from 'react';

type Stats = {
  publishedToday: number;
  totalMembers: number;
  pendingCount: number;
  totalArticles: number;
  activeDonors: number;
  newDonorsToday: number;
};

export default function AdminHome() {
  const [me, setMe] = useState<any>('loading');
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/me');
      const meData = meRes.ok ? await meRes.json() : null;
      setMe(meData);
      if (meData?.role === 'CHIEF_EDITOR') {
        const s = await fetch('/api/admin/stats');
        if (s.ok) setStats(await s.json());
      }
    })();
  }, []);

  if (me === 'loading') return <main className="max-w-5xl mx-auto px-4 py-10 text-gray-500">불러오는 중…</main>;
  if (!me || me.role !== 'CHIEF_EDITOR') {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-gray-600">편집장만 접근할 수 있는 관리자 화면입니다.</p>
      </main>
    );
  }

  const cards = [
    { label: '오늘 발행 기사', value: stats?.publishedToday ?? '—' },
    { label: '전체 발행 기사', value: stats?.totalArticles ?? '—' },
    { label: '승인 대기 중', value: stats?.pendingCount ?? '—', href: '/admin/pending' },
    { label: '전체 회원', value: stats?.totalMembers ?? '—', href: '/admin/members' },
    { label: '전체 후원자', value: stats?.activeDonors ?? '—' },
    { label: '오늘 신규 후원', value: stats?.newDonorsToday ?? '—' },
    { label: '신고 댓글 대기', value: '준비 중' },
  ];

  const links = [
    { href: '/admin/pending', label: '승인 대기함' },
    { href: '/admin/keywords', label: '키워드 관리' },
    { href: '/admin/special-characters', label: '특수문자 관리' },
    { href: '/admin/members', label: '회원 관리' },
  ];

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">관리자 대시보드</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {cards.map((c) => (
          <a
            key={c.label}
            href={c.href ?? '#'}
            className={`rounded-xl border border-gray-200 p-4 ${c.href ? 'hover:border-brand' : ''}`}
          >
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
          </a>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="text-sm font-semibold text-gray-700 border border-gray-200 rounded-full px-4 py-2 hover:border-brand hover:text-brand"
          >
            {l.label}
          </a>
        ))}
      </div>
    </main>
  );
}
