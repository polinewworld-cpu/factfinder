'use client';

import { useEffect, useState } from 'react';
import RippleDotCard from '@/components/RippleDotCard';
import { UserAvatar } from '@/components/InitialAvatar';
import { toFrenchBrackets } from '@/lib/frenchBrackets';

type Person = { id: string; name: string; nickname: string | null; image: string | null; createdAt: string; legacy?: boolean };

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
  donationAmountMonth: number; // 실제 결제된 후원 누적 총액
  recentArticles: { id: string; title: string; publishedAt: string | null; author: { name: string } }[];
  pendingArticles: { id: string; title: string; updatedAt: string; author: { name: string } }[];
  recentMembers: Person[];
  recentReporters: Person[];
  recentDonations: { id: string; donorName: string | null; amount: number; startedAt: string; reporter: { name: string } | null }[];
};

const fmtDay = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }) : '';

// 기사만 뜨는 작은 창 — 브라우저 주소창·탭 없이 (기사 화면의 ?popup=1 모드)
function openArticlePopup(id: string) {
  const w = 820;
  const h = Math.min(960, window.screen.availHeight - 60);
  const left = Math.max(0, (window.screen.availWidth - w) / 2);
  window.open(`/article/${id}?popup=1`, 'ff-article-popup', `popup=yes,width=${w},height=${h},left=${left},top=30,scrollbars=yes,resizable=yes`);
}

function CardHead({ label, value, href, linkText = '전체 보기' }: { label: string; value: React.ReactNode; href?: string; linkText?: string }) {
  return (
    <div className="flex items-start justify-between gap-2 mb-3">
      <div>
        <p className="text-xs text-gray-900/60 mb-1">{label}</p>
        <p className="text-4xl font-bold leading-none">{value}</p>
      </div>
      {href && (
        <a href={href} className="text-xs font-semibold text-gray-900/70 hover:text-gray-900 hover:underline whitespace-nowrap">
          {linkText} →
        </a>
      )}
    </div>
  );
}

function PeopleGrid({ people }: { people: Person[] }) {
  if (people.length === 0) return <p className="text-sm text-gray-900/60">아직 없습니다.</p>;
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-2">
      {people.map((u) => (
        <li key={u.id} className="flex items-center gap-2 min-w-0">
          <UserAvatar image={u.image} seed={u.id} name={u.nickname ?? u.name} className="w-6 h-6 text-[10px] rounded-full object-cover shrink-0" />
          <span className="text-sm truncate">{u.nickname ?? u.name}</span>
          <span className="text-[11px] text-gray-900/50 shrink-0">{u.legacy ? '이관' : fmtDay(u.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}

// 관리자 대시보드 — 전면 재설계: 빨간 면 박스 + 흰 글씨, 숫자를 누르면 해당 상세 탭으로 이동 (2026-09-11 개편)
// 2026-09-24: 카드 높이·숫자 2배, 배경에 마우스 반응 점 격자(RippleDotCard)
// 2026-10-08: 카드마다 목록 채움 — 최근 기사 7(누르면 기사만 뜨는 창), 승인을 기다리는 기사, 최근 회원·기자 12, 최근 후원
export default function AdminHome() {
  const [me, setMe] = useState<any>('loading');
  const [stats, setStats] = useState<Stats | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/me');
      const meData = meRes.ok ? await meRes.json() : null;
      setMe(meData);
      if (meData?.role === 'CHIEF_EDITOR') {
        const s = await fetch('/api/admin/stats');
        if (s.ok) setStats(await s.json());
        // 방문 분석(매일 아침 자동 생성) 요약 — 실패해도 대시보드는 그대로
        fetch('/api/admin/analytics')
          .then((r) => r.json())
          .then(setAnalysis)
          .catch(() => setAnalysis({ error: '불러오지 못했습니다' }));
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
    <main className="py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">관리자 대시보드</h1>

      {!stats ? (
        <p className="text-sm text-gray-400">불러오는 중…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 발행기사 — 오늘 발행 수 / 전체, 최근 7개는 누르면 기사만 뜨는 창 */}
          <RippleDotCard className="min-h-[250px]">
            <CardHead
              label="발행기사 (오늘 / 전체)"
              value={`${stats.publishedToday}/${stats.totalArticles.toLocaleString()}`}
              href="/admin/articles"
            />
            <ul className="space-y-1.5">
              {stats.recentArticles.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => openArticlePopup(a.id)}
                    className="w-full text-left flex items-baseline gap-2 hover:underline"
                    title="기사만 따로 열기"
                  >
                    <span className="text-[11px] text-gray-900/50 shrink-0 w-9">{fmtDay(a.publishedAt)}</span>
                    <span className="text-sm truncate">{toFrenchBrackets(a.title)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </RippleDotCard>

          {/* 승인을 기다리는 기사 */}
          <RippleDotCard className="min-h-[250px]">
            <CardHead label="승인을 기다리는 기사" value={stats.pendingCount} href="/admin/pending" linkText="승인하러 가기" />
            {stats.pendingArticles.length === 0 ? (
              <p className="text-sm text-gray-900/60">승인을 기다리는 기사가 없습니다.</p>
            ) : (
              <ul className="space-y-1.5">
                {stats.pendingArticles.map((a) => (
                  <li key={a.id}>
                    <a href={`/write?id=${a.id}`} className="flex items-baseline gap-2 hover:underline">
                      <span className="text-[11px] text-gray-900/50 shrink-0 w-12 truncate">{a.author.name}</span>
                      <span className="text-sm truncate">{toFrenchBrackets(a.title) || '(제목 없음)'}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </RippleDotCard>

          {/* 회원 — 오늘 가입 / 전체, 최근 12명 */}
          <RippleDotCard className="min-h-[250px]">
            <CardHead label="회원 (오늘 / 전체)" value={`${stats.newMembersToday}/${stats.totalMembers}`} href="/admin/members" />
            <PeopleGrid people={stats.recentMembers} />
          </RippleDotCard>

          {/* 기자 — 신청 대기 / 현재 기자, 최근 12명 */}
          <RippleDotCard className="min-h-[250px]">
            <CardHead
              label="기자 (신청 대기 / 현재)"
              value={
                <>
                  <a href="/admin/reporter-applications" className="hover:underline">{stats.pendingReporterCount}</a>/
                  <a href="/admin/members?role=REPORTER" className="hover:underline">{stats.currentReporterCount}</a>
                </>
              }
              href="/admin/members?role=REPORTER"
            />
            <PeopleGrid people={stats.recentReporters} />
          </RippleDotCard>

          {/* 후원 — 실제 결제된 후원 누적 총액 + 오늘, 최근 후원자·금액·기자 */}
          <RippleDotCard className="min-h-[250px]">
            <CardHead label="후원 누적" value={`${stats.donationAmountMonth.toLocaleString()}원`} href="/admin/donations" />
            <p className="text-sm text-gray-900/60 -mt-1 mb-3">오늘 {stats.donationAmountToday.toLocaleString()}원</p>
            {stats.recentDonations.length === 0 ? (
              <p className="text-sm text-gray-900/60">아직 후원이 없습니다.</p>
            ) : (
              <ul className="space-y-1.5">
                {stats.recentDonations.map((d) => (
                  <li key={d.id} className="flex items-baseline gap-2 text-sm">
                    <span className="text-[11px] text-gray-900/50 shrink-0 w-9">{fmtDay(d.startedAt)}</span>
                    <span className="truncate">{d.donorName ?? '-'}</span>
                    <span className="font-semibold shrink-0">{d.amount.toLocaleString()}원</span>
                    <span className="text-[11px] text-gray-900/60 truncate">→ {d.reporter?.name ?? '사이트 전체'}</span>
                  </li>
                ))}
              </ul>
            )}
          </RippleDotCard>

          {/* 방문 분석 — 제미나이 한 줄 요약 + 다음 주 할 일 (2026-10-09) */}
          <RippleDotCard className="min-h-[250px]">
            <CardHead
              label="방문자 (최근 7일)"
              value={analysis?.report ? analysis.report.summary.users.toLocaleString() : '-'}
              href="/admin/analytics"
              linkText="방문 분석 보기"
            />
            {!analysis ? (
              <p className="text-sm text-gray-900/60">불러오는 중…</p>
            ) : analysis.report?.ai ? (
              <>
                <p className="text-[11px] text-gray-900/50 mb-1">오늘의 기사 아이디어</p>
                <p className="text-sm font-semibold mb-2">{analysis.report.ai.headline}</p>
                <ul className="space-y-1 list-disc pl-4">
                  {/* 2026-10-09: 기사 아이디어가 있으면 그것(순위·제목 예시), 없으면 옛 보고서의 할 일 */}
                  {analysis.report.ai.ideas?.length
                    ? analysis.report.ai.ideas.slice(0, 3).map((it: any, i: number) => (
                        <li key={i} className="text-sm text-gray-900/80">
                          <b>{it.priority}순위</b> {it.headline}
                        </li>
                      ))
                    : analysis.report.ai.nextWeekActions.slice(0, 3).map((t: string, i: number) => (
                        <li key={i} className="text-sm text-gray-900/80">{t}</li>
                      ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-gray-900/60">
                {analysis.error ?? analysis.report?.aiError ?? (analysis.configured === false ? '구글 애널리틱스 연결 전입니다.' : '분석이 아직 없습니다.')}
              </p>
            )}
          </RippleDotCard>
        </div>
      )}
    </main>
  );
}
