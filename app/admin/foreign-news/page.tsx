'use client';

import { useEffect, useRef, useState } from 'react';
import type { ForeignNewsReport, ForeignPick } from '@/lib/foreignNews';
import PersonaHeader from '@/components/PersonaHeader';
import LinkedText from '@/components/LinkedText';
import PastReportsButton, { type PastItem } from '@/components/PastReportsButton';

// 관리자 "김정신 특파원" (2026-10-10) — 영미 주요 외신 중 한국 관련 이슈를 현지 언론이 어떻게 다루는지 살핀 보고서.
// 하루 3번(07·13·19시) 올라오고, 존댓말 권고와 근거가 된 현지 언론 기사 링크가 항상 붙는다.
// 화면 모양은 오진실 기자(동향 보고, components/AnalyticsView.tsx)와 같은 틀 — 머리글(사진+이름+새로고침) → 인사 → 카드들 → 마무리 인사.
const BIG_TITLE = 'text-xl font-bold text-gray-900';
const MARK = '#0d4f55';
const SLOT_LABEL: Record<number, string> = { 7: '아침 보고', 13: '낮 보고', 19: '저녁 보고', 0: '새벽 보고' };

function ago(iso: string | null) {
  if (!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 60) return `${m}분 전`;
  if (m < 60 * 24) return `${Math.round(m / 60)}시간 전`;
  return `${Math.round(m / 1440)}일 전`;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border rounded-xl p-4">
      <h2 className={`${BIG_TITLE} mb-3`}>{title}</h2>
      {children}
    </section>
  );
}

function PickCard({ p }: { p: ForeignPick }) {
  return (
    <article className="border rounded-lg p-3 text-sm">
      <p className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <span className="rounded px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: p.priority === 1 ? MARK : p.priority === 2 ? '#4f7f83' : '#8a9a98' }}>
          {p.priority}순위
        </span>
        <span className="rounded border px-1.5 py-0.5 text-[11px] font-semibold">{p.outlet}</span>
        <span className="text-[11px] text-gray-400">{ago(p.publishedAt)}</span>
      </p>
      <p className="font-bold text-[15px] leading-snug mb-1">{p.titleKo || p.originalTitle}</p>
      {p.titleKo && <p className="text-xs text-gray-400 mb-2">{p.originalTitle}</p>}
      {p.summaryKo && <p className="text-gray-600 mb-2">{p.summaryKo}</p>}
      {p.whyKorea && <p className="mb-1"><b className="text-xs text-gray-500 mr-1">한국과의 관련</b>{p.whyKorea}</p>}
      {p.tone && <p className="mb-1"><b className="text-xs text-gray-500 mr-1">현지 언론의 시각</b>{p.tone}</p>}
      {p.advice && <p className="mb-1"><b className="text-xs text-gray-500 mr-1">권고</b>{p.advice}</p>}
      <p className="text-[11px] text-gray-500 mt-2">
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
          [{p.outlet}] 원문 보기 ↗
        </a>
      </p>
    </article>
  );
}

function Report({ r }: { r: ForeignNewsReport }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        {r.greeting && <p className="text-sm font-semibold text-gray-900 leading-relaxed">{r.greeting}</p>}
        {r.localColor && (
          <p className="text-sm text-gray-800 leading-relaxed">
            <LinkedText text={r.localColor} />
          </p>
        )}
      </div>

      {((r.overviewItems ?? []).length > 0 || r.overview) && (
        <Card title="오늘의 이슈">
          {(r.overviewItems ?? []).length > 0 ? (
            <ul className="space-y-1.5">
              {(r.overviewItems ?? []).map((t, i) => (
                <li key={i} className="text-sm text-gray-800 leading-relaxed">
                  · <LinkedText text={t} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-800 leading-relaxed">
              <LinkedText text={r.overview} />
            </p>
          )}
        </Card>
      )}

      {r.aiError && <p className="text-xs text-amber-700">{r.aiError}</p>}

      {(r.briefs ?? []).length > 0 && (
        <Card title="이게 기사각입니다">
          {(r.carriedOver ?? 0) > 0 && <p className="mb-2 text-xs text-gray-400">새 소식이 적어서 지난 보고에서 {r.carriedOver}건을 이어서 보여 드려요.</p>}
          <ul className="space-y-1.5">
            {r.briefs.map((b) => (
              <li key={b.url} className="text-sm text-gray-800 leading-snug">
                · {b.text}
                {b.advice ? <span className="text-gray-600"> {b.advice}</span> : null}
                {(b.sources ?? []).length > 0 ? (
                  <ul className="mt-1 mb-2 ml-3 space-y-0.5">
                    {(b.sources ?? []).map((sc) => (
                      <li key={sc.url} className="text-xs text-gray-600 leading-snug">
                        – <span className="font-semibold">{sc.outlet}</span>{' '}
                        <a href={sc.url} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: MARK }}>
                          {sc.titleEn}
                        </a>
                        {sc.titleKo ? <span> ({sc.titleKo})</span> : null} ↗
                      </li>
                    ))}
                  </ul>
                ) : (
                  <>
                    {' '}
                    <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline whitespace-nowrap" style={{ color: MARK }}>
                      {b.outlet} ↗
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {r.picks.length > 0 && (
        <Card title="상세 보고">
          <div className="grid lg:grid-cols-2 gap-3">
            {r.picks.map((p) => (
              <PickCard key={p.url} p={p} />
            ))}
          </div>
        </Card>
      )}

      {r.closing && (
        <section className="border rounded-xl p-4">
          <p className="text-sm text-gray-800 leading-relaxed">{r.closing}</p>
        </section>
      )}

      {(r.briefs.length > 0 || r.picks.length > 0) && (
        <p className="text-xs text-gray-500">
          참고한 현지 언론: {Array.from(new Set([...r.briefs.map((b) => b.outlet), ...r.picks.map((p) => p.outlet)])).join(' · ')} — 외신 {r.fetched}건 중 한국 관련 후보 {r.candidates}건
        </p>
      )}
      {r.sourceErrors.length > 0 && (
        <p className="text-xs text-gray-500">이번에 받지 못한 외신: {r.sourceErrors.map((s) => `${s.outlet}(${s.error})`).join(', ')}</p>
      )}
    </div>
  );
}

export default function ForeignNewsPage() {
  const [reports, setReports] = useState<ForeignNewsReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const autoRefreshed = useRef(false);

  async function load(refresh = false) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/foreign-news${refresh ? '?refresh=1' : ''}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? '불러오지 못했습니다');
      setReports(data.reports ?? []);
      // 옛 형식(현지 이야기가 없는) 최신 보고라면 새 형식으로 딱 한 번 다시 만든다 — 실패해도 되풀이하지 않음
      if (!refresh && !autoRefreshed.current && data.reports?.[0] && !data.reports[0].localColor) {
        autoRefreshed.current = true;
        await load(true);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다');
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const [latest] = reports;
  const pastItems: PastItem[] = reports.map((r) => {
    const kst = new Date(Date.parse(r.generatedAt) + 9 * 3600_000).toISOString();
    return { id: r.generatedAt, date: kst.slice(0, 10), order: `${kst.slice(0, 10)}-${String(r.slot).padStart(2, '0')}-${kst.slice(11, 16)}`, label: SLOT_LABEL[r.slot] ?? '보고', node: <Report r={r} /> };
  });

  return (
    <main className="py-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <PersonaHeader personaKey="kim" name="김정신 특파원" alt="김정신 특파원(AI가 만든 가상 인물)" />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => load(true)} disabled={loading} className="border rounded-lg px-3 py-1.5 text-sm disabled:opacity-40">
            {loading ? '새로 받는 중… (1분쯤)' : '지금 새로고침'}
          </button>
          <PastReportsButton items={pastItems} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && !latest && <p className="text-sm text-gray-500">외신을 살펴보는 중입니다. 처음에는 1분 가까이 걸릴 수 있습니다…</p>}

      {latest && <Report r={latest} />}

      {!loading && reports.length === 0 && !error && <p className="text-sm text-gray-400">아직 올라온 보고가 없습니다.</p>}
    </main>
  );
}
