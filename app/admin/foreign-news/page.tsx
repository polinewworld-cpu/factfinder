'use client';

import { useEffect, useState } from 'react';
import type { ForeignNewsReport, ForeignPick } from '@/lib/foreignNews';
import { compressImageFile } from '@/lib/imageCompress';

// 관리자 "김정신 특파원" (2026-10-10) — 영미 주요 외신 중 한국 관련 이슈를 현지 언론이 어떻게 다루는지 살핀 보고서.
// 하루 3번(07·13·19시) 올라오고, 존댓말 권고와 근거가 된 현지 언론 기사 링크가 항상 붙는다. 프로필 사진은 AI가 만든 가상 인물(편집장이 올림).
const PRIORITY_LABEL: Record<number, string> = { 1: '1순위', 2: '2순위', 3: '3순위' };
const SLOT_LABEL: Record<number, string> = { 7: '아침 보고', 13: '낮 보고', 19: '저녁 보고', 0: '새벽 보고' };

function ago(iso: string | null) {
  if (!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 60) return `${m}분 전`;
  if (m < 60 * 24) return `${Math.round(m / 60)}시간 전`;
  return `${Math.round(m / 1440)}일 전`;
}

function when(iso: string) {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}

function Avatar({ url, size }: { url: string | null; size: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`${url}?w=800`} alt="김정신 특파원(AI가 만든 가상 인물)" width={size} height={size} className="rounded-full object-cover object-top border border-gray-200 shrink-0" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full bg-gray-200 text-gray-500 font-bold flex items-center justify-center shrink-0" style={{ width: size, height: size, fontSize: size / 2.5 }}>
      김
    </div>
  );
}

function PickCard({ p }: { p: ForeignPick }) {
  return (
    <li className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
        <span className="font-bold text-brand">{PRIORITY_LABEL[p.priority] ?? ''}</span>
        <span className="font-semibold text-gray-700">{p.outlet}</span>
        <span>{ago(p.publishedAt)}</span>
      </div>
      <p className="font-bold text-gray-900 mb-1">{p.titleKo || p.originalTitle}</p>
      {p.titleKo && <p className="text-xs text-gray-400 mb-2">{p.originalTitle}</p>}
      {p.summaryKo && <p className="text-sm text-gray-700 mb-2">{p.summaryKo}</p>}
      {p.whyKorea && <p className="text-xs text-gray-500 mb-1"><b>한국과의 관련:</b> {p.whyKorea}</p>}
      {p.tone && <p className="text-xs text-gray-500 mb-1"><b>현지 언론의 시각:</b> {p.tone}</p>}
      {p.advice && <p className="text-sm text-gray-900 bg-brand/5 rounded-lg px-3 py-2 my-2"><b>권고:</b> {p.advice}</p>}
      <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand underline">
        {p.outlet} 원문 보기 ↗
      </a>
    </li>
  );
}

function Report({ r }: { r: ForeignNewsReport }) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-900 mb-1">{r.greeting}</p>
      {r.overview && <p className="text-sm text-gray-700 mb-3">{r.overview}</p>}
      {r.aiError && <p className="text-amber-700 text-xs mb-3">{r.aiError}</p>}
      <ul className="space-y-3">
        {r.picks.map((p) => (
          <PickCard key={p.url} p={p} />
        ))}
      </ul>
      {r.picks.length > 0 && (
        <p className="text-xs text-gray-400 mt-3">
          참고한 현지 언론: {Array.from(new Set(r.picks.map((p) => p.outlet))).join(' · ')} — 외신 {r.fetched}건 중 한국 관련 후보 {r.candidates}건
        </p>
      )}
      {r.sourceErrors.length > 0 && (
        <p className="text-xs text-gray-400 mt-1">이번에 받지 못한 외신: {r.sourceErrors.map((s) => `${s.outlet}(${s.error})`).join(', ')}</p>
      )}
    </div>
  );
}

export default function ForeignNewsPage() {
  const [reports, setReports] = useState<ForeignNewsReport[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [canEditAvatar, setCanEditAvatar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);

  async function load(refresh = false) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/foreign-news${refresh ? '?refresh=1' : ''}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? '불러오지 못했습니다');
      setReports(data.reports ?? []);
      setAvatarUrl(data.avatarUrl ?? null);
      setCanEditAvatar(!!data.canEditAvatar);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다');
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function changeAvatar(file: File) {
    setAvatarBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', await compressImageFile(file));
      const up = await fetch('/api/upload', { method: 'POST', body: fd });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok) throw new Error(upData.error ?? '사진 올리기에 실패했습니다');
      const res = await fetch('/api/admin/foreign-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: upData.url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? '사진을 저장하지 못했습니다');
      setAvatarUrl(data.avatarUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진 올리기에 실패했습니다');
    }
    setAvatarBusy(false);
  }

  const [latest, ...earlier] = reports;

  return (
    <main className="py-8">
      <section className="flex items-center gap-4 mb-2">
        <Avatar url={avatarUrl} size={88} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-gray-900">김정신 특파원</h1>
          <p className="text-sm text-gray-600">팩트파인더 특파원 · 현지 주요 언론이 한국 이슈를 어떻게 다루는지 살펴 하루 세 번(아침·낮·저녁) 보고드립니다.</p>
          <p className="text-xs text-gray-400 mt-1">프로필 사진은 AI가 만든 가상 인물이며, 보고서는 외신 제목·소개글을 바탕으로 AI가 작성한 내부 참고 자료입니다.</p>
        </div>
      </section>
      <div className="flex items-center gap-2 mb-6">
        <button
          type="button"
          disabled={loading}
          onClick={() => load(true)}
          className="text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400 disabled:opacity-50"
        >
          {loading ? '불러오는 중…' : '지금 새로 보고받기'}
        </button>
        {canEditAvatar && (
          <label className={`text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400 cursor-pointer ${avatarBusy ? 'opacity-50 pointer-events-none' : ''}`}>
            {avatarBusy ? '올리는 중…' : '프로필 사진 바꾸기'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) changeAvatar(f);
              }}
            />
          </label>
        )}
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {loading && !latest && <p className="text-gray-500 text-sm">외신을 살펴보는 중입니다. 처음에는 1분 가까이 걸릴 수 있습니다…</p>}

      {latest && (
        <section className="mb-8">
          <p className="text-xs text-gray-400 mb-3">
            {when(latest.generatedAt)} {SLOT_LABEL[latest.slot] ?? ''} · {ago(latest.generatedAt)}
          </p>
          <Report r={latest} />
        </section>
      )}

      {earlier.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-2">지난 보고</h2>
          <div className="space-y-2">
            {earlier.map((r) => (
              <details key={r.generatedAt} className="border border-gray-200 rounded-xl px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                  {when(r.generatedAt)} {SLOT_LABEL[r.slot] ?? ''} <span className="font-normal text-gray-400">· 추천 {r.picks.length}건</span>
                </summary>
                <div className="mt-3">
                  <Report r={r} />
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {!loading && reports.length === 0 && !error && <p className="text-sm text-gray-400">아직 올라온 보고가 없습니다.</p>}
    </main>
  );
}
