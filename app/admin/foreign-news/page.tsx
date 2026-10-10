'use client';

import { useEffect, useState } from 'react';
import type { ForeignNewsReport } from '@/lib/foreignNews';

// 관리자 "외신 추천" (2026-10-10) — 영미 주요 외신 중 한국 관련 이슈를 다룬 기사만, 한국어 제목·요약·쓸 각도와 함께. 3시간마다 자동 갱신
const PRIORITY_LABEL: Record<number, string> = { 1: '1순위', 2: '2순위', 3: '3순위' };

function ago(iso: string | null) {
  if (!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 60) return `${m}분 전`;
  if (m < 60 * 24) return `${Math.round(m / 60)}시간 전`;
  return `${Math.round(m / 1440)}일 전`;
}

export default function ForeignNewsPage() {
  const [report, setReport] = useState<ForeignNewsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(refresh = false) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/foreign-news${refresh ? '?refresh=1' : ''}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? '불러오지 못했습니다');
      setReport(data.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다');
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">외신 추천</h1>
        <button
          type="button"
          disabled={loading}
          onClick={() => load(true)}
          className="text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400 disabled:opacity-50"
        >
          {loading ? '불러오는 중…' : '지금 새로 받기'}
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-1">영미 주요 외신 중 한국 관련 이슈를 다룬 기사만 골라 한국어로 요약했습니다. 3시간마다 자동으로 갱신됩니다.</p>
      <p className="text-xs text-gray-400 mb-6">제목과 짧은 소개글만 사용하며 기사 본문은 가져오지 않습니다. 요약은 AI가 만든 것이니 원문에서 꼭 확인하세요.</p>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {loading && !report && <p className="text-gray-500 text-sm">외신을 모으는 중입니다. 처음에는 1분 가까이 걸릴 수 있습니다…</p>}

      {report && (
        <>
          <p className="text-xs text-gray-400 mb-4">
            {ago(report.generatedAt)} 갱신 · 외신 {report.fetched}건 중 한국 관련 후보 {report.candidates}건 → {report.picks.length}건 추천
          </p>
          {report.aiError && <p className="text-amber-700 text-sm mb-4">{report.aiError}</p>}

          <ul className="space-y-3">
            {report.picks.map((p) => (
              <li key={p.url} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <span className="font-bold text-brand">{PRIORITY_LABEL[p.priority] ?? ''}</span>
                  <span>{p.outlet}</span>
                  <span>{ago(p.publishedAt)}</span>
                </div>
                <p className="font-bold text-gray-900 mb-1">{p.titleKo || p.originalTitle}</p>
                {p.titleKo && <p className="text-xs text-gray-400 mb-2">{p.originalTitle}</p>}
                {p.summaryKo && <p className="text-sm text-gray-700 mb-2">{p.summaryKo}</p>}
                {p.whyKorea && <p className="text-xs text-gray-500 mb-1"><b>한국과의 관련:</b> {p.whyKorea}</p>}
                {p.angle && <p className="text-xs text-gray-700 mb-2"><b>쓸 각도:</b> {p.angle}</p>}
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand underline">
                  원문 보기
                </a>
              </li>
            ))}
            {report.picks.length === 0 && <p className="text-sm text-gray-400">지금은 추천할 한국 관련 외신 기사가 없습니다.</p>}
          </ul>

          {report.sourceErrors.length > 0 && (
            <p className="text-xs text-gray-400 mt-6">
              일부 외신은 이번에 못 받았습니다: {report.sourceErrors.map((s) => `${s.outlet}(${s.error})`).join(', ')}
            </p>
          )}
        </>
      )}
    </main>
  );
}
