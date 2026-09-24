'use client';

import { useEffect, useState } from 'react';
import RippleDotCard from '@/components/RippleDotCard';

type Stats = {
  publishedToday: number;
  totalMembers: number;
  newMembersToday: number;
  pendingCount: number;
  totalArticles: number;
  activeDonors: number;
  newDonorsToday: number;
  pendingReporterCount: number;
  currentReporterCount: number;
  donationAmountToday: number;
  donationAmountMonth: number;
};

// 관리자 대시보드 — 전면 재설계: 빨간 면 박스 + 흰 글씨, 숫자를 누르면 해당 상세 탭으로 이동 (2026-09-11 개편)
// 2026-09-24: 카드 높이·숫자 2배, 배경에 마우스 반응 점 격자(RippleDotCard)
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

  return (
    <main className="px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">관리자 대시보드</h1>

      {!stats ? (
        <p className="text-sm text-gray-400">불러오는 중…</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {/* 발행기사 — 오늘/전체. 전체 숫자를 누르면 전체기사 탭으로 */}
          <RippleDotCard className="h-[250px]">
            <p className="text-xs text-white/70 mb-1">발행기사</p>
            <p className="text-5xl font-bold">
              {stats.publishedToday}/
              <a href="/admin/articles" className="hover:underline">
                {stats.totalArticles}
              </a>
            </p>
          </RippleDotCard>

          {/* 승인대기 — 단일 지표, 누르면 승인대기함으로 */}
          <RippleDotCard href="/admin/pending" className="h-[250px] hover:opacity-90">
            <p className="text-xs text-white/70 mb-1">승인대기</p>
            <p className="text-5xl font-bold">{stats.pendingCount}</p>
          </RippleDotCard>

          {/* 회원 — 뭘 눌러도 회원 관리탭으로 */}
          <RippleDotCard href="/admin/members" className="h-[250px] hover:opacity-90">
            <p className="text-xs text-white/70 mb-1">회원</p>
            <p className="text-5xl font-bold">
              {stats.newMembersToday}/{stats.totalMembers}
            </p>
          </RippleDotCard>

          {/* 기자 — 대기중 숫자는 기자신청 대기함으로, 현재 숫자는 기자관리 메뉴로 */}
          <RippleDotCard className="h-[250px]">
            <p className="text-xs text-white/70 mb-1">기자</p>
            <p className="text-5xl font-bold">
              <a href="/admin/reporter-applications" className="hover:underline">
                {stats.pendingReporterCount}
              </a>
              /
              <a href="/admin/members?role=REPORTER" className="hover:underline">
                {stats.currentReporterCount}
              </a>
            </p>
          </RippleDotCard>

          {/* 후원 — 오늘 금액/이번달 금액, 누르면 전체 후원리스트로 */}
          <RippleDotCard href="/admin/donations" className="h-[250px] hover:opacity-90">
            <p className="text-xs text-white/70 mb-1">후원</p>
            <p className="text-5xl font-bold">
              {stats.donationAmountToday.toLocaleString()}/{stats.donationAmountMonth.toLocaleString()}
            </p>
          </RippleDotCard>
        </div>
      )}
    </main>
  );
}
