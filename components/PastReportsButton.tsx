'use client';

import { useEffect, useMemo, useState } from 'react';
import { closeOnBackdrop } from '@/lib/backdrop';

// "지난 보고" 버튼 + 레이어 팝업 (2026-10-10) — 왼쪽 달력에서 날짜를 고르고, 오른쪽에서 그날 보고를 읽고, 좌우 버튼으로 이전·다음 보고로 넘긴다.
// 오진실 기자(지난 편지)·김정신 특파원(지난 보고)이 같이 쓴다. 보고 내용 그리기는 부르는 쪽이 node로 넘김.
export type PastItem = {
  id: string;
  date: string; // YYYY-MM-DD (한국 날짜)
  order: string; // 시간 순서 비교용 문자열 (YYYY-MM-DD-HH …)
  label: string; // 예) 아침 보고 / 15시 편지
  node: React.ReactNode;
};

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

function monthKey(date: string) {
  return date.slice(0, 7);
}

export default function PastReportsButton({
  items,
  buttonLabel = '지난 보고',
  onOpen,
  loading = false,
}: {
  items: PastItem[];
  buttonLabel?: string;
  onOpen?: () => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sorted = useMemo(() => [...items].sort((a, b) => (a.order < b.order ? -1 : 1)), [items]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState<string>('');

  const selected = sorted.find((i) => i.id === selectedId) ?? sorted[sorted.length - 1] ?? null;
  const idx = selected ? sorted.findIndex((i) => i.id === selected.id) : -1;
  const datesWithItems = useMemo(() => new Set(sorted.map((i) => i.date)), [sorted]);
  const sameDay = selected ? sorted.filter((i) => i.date === selected.date) : [];

  // 팝업을 열 때마다 가장 최근 보고로
  useEffect(() => {
    if (!open) return;
    const last = sorted[sorted.length - 1];
    if (last) {
      setSelectedId(last.id);
      setViewMonth(monthKey(last.date));
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sorted.length]);

  function go(i: number) {
    const it = sorted[i];
    if (!it) return;
    setSelectedId(it.id);
    setViewMonth(monthKey(it.date));
  }

  function moveMonth(delta: number) {
    const [y, m] = (viewMonth || monthKey(selected?.date ?? new Date().toISOString().slice(0, 10))).split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setViewMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }

  function pickDay(date: string) {
    const day = sorted.filter((i) => i.date === date);
    if (day.length) setSelectedId(day[day.length - 1].id); // 그날 가장 늦은 보고부터
  }

  // 달력 칸 만들기
  const [vy, vm] = (viewMonth || '1970-01').split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(vy, vm - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(vy, vm, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <>
      <button
        type="button"
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
        className="border rounded-lg px-3 py-1.5 text-sm"
      >
        {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" {...closeOnBackdrop(() => setOpen(false))}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden" role="dialog" aria-label={buttonLabel}>
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="text-lg font-bold text-gray-900">{buttonLabel}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="text-2xl leading-none text-gray-500 px-2">
                ×
              </button>
            </div>

            {loading ? (
              <p className="p-6 text-sm text-gray-500">불러오는 중…</p>
            ) : sorted.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">아직 보관된 보고가 없습니다.</p>
            ) : (
              <div className="flex flex-col md:flex-row min-h-0 flex-1">
                {/* 왼쪽: 달력 */}
                <div className="md:w-64 shrink-0 border-b md:border-b-0 md:border-r p-4">
                  <div className="flex items-center justify-between mb-2">
                    <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달" className="px-2 py-1 border rounded text-sm">
                      ◀
                    </button>
                    <span className="text-sm font-bold text-gray-900">
                      {vy}년 {vm}월
                    </span>
                    <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달" className="px-2 py-1 border rounded text-sm">
                      ▶
                    </button>
                  </div>
                  <div className="grid grid-cols-7 text-center text-[11px] text-gray-400 mb-1">
                    {WEEK.map((w) => (
                      <span key={w}>{w}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-y-1 text-center">
                    {cells.map((d, i) => {
                      if (d === null) return <span key={`e${i}`} />;
                      const date = `${viewMonth}-${String(d).padStart(2, '0')}`;
                      const has = datesWithItems.has(date);
                      const isSel = selected?.date === date;
                      return (
                        <button
                          key={date}
                          type="button"
                          disabled={!has}
                          onClick={() => pickDay(date)}
                          className={`mx-auto w-8 h-8 rounded-full text-sm ${
                            isSel ? 'bg-brand text-white font-bold' : has ? 'font-bold text-gray-900 hover:bg-gray-100' : 'text-gray-300'
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-3">굵게 표시된 날에 보고가 있어요.</p>
                </div>

                {/* 오른쪽: 선택한 보고 */}
                <div className="flex-1 min-w-0 flex flex-col min-h-0">
                  <div className="flex items-center justify-between gap-2 px-4 py-2 border-b">
                    <button type="button" onClick={() => go(idx - 1)} disabled={idx <= 0} className="px-3 py-1 border rounded text-sm disabled:opacity-30">
                      ◀ 이전
                    </button>
                    <div className="flex flex-wrap items-center justify-center gap-1.5 text-sm">
                      <span className="font-bold text-gray-900">{selected?.date.replace(/^\d{4}-0?(\d+)-0?(\d+)$/, '$1월 $2일')}</span>
                      {sameDay.map((i) => (
                        <button
                          key={i.id}
                          type="button"
                          onClick={() => go(sorted.findIndex((x) => x.id === i.id))}
                          className={`px-2 py-0.5 rounded-full border text-xs ${i.id === selected?.id ? 'bg-brand text-white border-transparent' : 'text-gray-600'}`}
                        >
                          {i.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => go(idx + 1)} disabled={idx < 0 || idx >= sorted.length - 1} className="px-3 py-1 border rounded text-sm disabled:opacity-30">
                      다음 ▶
                    </button>
                  </div>
                  <div className="p-4 overflow-y-auto min-h-0">{selected?.node}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
