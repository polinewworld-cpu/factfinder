'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserAvatar } from '@/components/InitialAvatar';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '정상',
  CANCELLED: '취소',
};

const PAY_METHOD_LABELS: Record<string, string> = {
  Card: '카드',
  CARD: '카드',
  VCard: '카드',
  DirectBank: '계좌이체',
  BANK: '계좌이체',
};

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

// 후원내역 — 옛 사이트 관리자 "운영관리 > 후원내역"을 이식 (2026-10-08)
// 기간·기자명 검색, 주문번호·기사·기자·후원인·후원액·후원일시 + 여러 건 골라 한 번에 정산 완료 처리.
export default function DonationsAdminPage() {
  const [me, setMe] = useState<any>('loading');
  const [donations, setDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reporter, setReporter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (filters: { from: string; to: string; reporter: string }) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.reporter.trim()) params.set('reporter', filters.reporter.trim());
    const res = await fetch(`/api/admin/donations?${params}`);
    if (res.ok) setDonations(await res.json());
    setSelected(new Set());
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/me');
      const meData = meRes.ok ? await meRes.json() : null;
      setMe(meData);
      if (meData?.role === 'CHIEF_EDITOR') await load({ from: '', to: '', reporter: '' });
      else setLoading(false);
    })();
  }, [load]);

  // 정산 대상 = 결제 완료(정상)이면서 아직 정산 안 된 건
  const selectable = useMemo(() => donations.filter((d) => d.status === 'ACTIVE' && !d.settled), [donations]);
  const total = useMemo(() => donations.filter((d) => d.status === 'ACTIVE').reduce((s, d) => s + d.amount, 0), [donations]);
  const selectedTotal = useMemo(
    () => donations.filter((d) => selected.has(d.id)).reduce((s, d) => s + d.amount, 0),
    [donations, selected],
  );
  const allSelected = selectable.length > 0 && selectable.every((d) => selected.has(d.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable.map((d) => d.id)));
  }

  async function settleSelected() {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}건(${selectedTotal.toLocaleString()}원)을 정산 완료로 바꿀까요?`)) return;
    setBusy(true);
    const res = await fetch('/api/settlement/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ donationIds: [...selected] }),
    });
    setBusy(false);
    if (!res.ok) return alert('정산 완료 처리에 실패했습니다.');
    const now = new Date().toISOString();
    setDonations((prev) => prev.map((d) => (selected.has(d.id) ? { ...d, settled: true, settledAt: now } : d)));
    setSelected(new Set());
  }

  if (me === 'loading') return <main className="max-w-5xl mx-auto px-4 py-10 text-gray-500">불러오는 중…</main>;
  if (!me || me.role !== 'CHIEF_EDITOR') {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-gray-600">편집장만 접근할 수 있습니다.</p>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-4">후원내역</h1>

      <form
        className="flex flex-wrap items-center gap-2 mb-4 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          load({ from, to, reporter });
        }}
      >
        <span className="text-gray-500">기간</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5" />
        <span className="text-gray-400">~</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5" />
        <input
          value={reporter}
          onChange={(e) => setReporter(e.target.value)}
          placeholder="기자명"
          className="border border-gray-200 rounded-lg px-3 py-1.5 w-36"
        />
        <button type="submit" className="border border-gray-300 rounded-lg px-4 py-1.5 font-semibold text-gray-700 hover:bg-gray-50">
          검색
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-sm">
        <p className="text-gray-500">
          {donations.length.toLocaleString()}건 · 결제 합계 <b className="text-gray-900">{total.toLocaleString()}원</b>
        </p>
        <button
          type="button"
          onClick={settleSelected}
          disabled={busy || selected.size === 0}
          className="rounded-lg px-4 py-1.5 font-semibold text-white bg-brand disabled:opacity-40"
        >
          {selected.size > 0 ? `선택한 ${selected.size}건 정산 완료 (${selectedTotal.toLocaleString()}원)` : '정산 완료 처리'}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">불러오는 중…</p>
      ) : donations.length === 0 ? (
        <p className="text-sm text-gray-400">후원 내역이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-sm border-collapse min-w-[900px]">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-200 bg-gray-50 whitespace-nowrap">
                <th className="py-2 pl-4 pr-2 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={selectable.length === 0} title="미정산 전체 선택" />
                </th>
                <th className="py-2 pr-4 font-semibold">주문번호</th>
                <th className="py-2 pr-4 font-semibold">기사</th>
                <th className="py-2 pr-4 font-semibold">기자명</th>
                <th className="py-2 pr-4 font-semibold">후원인</th>
                <th className="py-2 pr-4 font-semibold">후원액</th>
                <th className="py-2 pr-4 font-semibold">결제</th>
                <th className="py-2 pr-4 font-semibold">정산</th>
                <th className="py-2 pr-4 font-semibold">후원일시</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d) => {
                const canSelect = d.status === 'ACTIVE' && !d.settled;
                return (
                  <tr key={d.id} className={`border-b border-gray-100 ${selected.has(d.id) ? 'bg-brand/5' : 'hover:bg-gray-50'}`}>
                    <td className="py-2 pl-4 pr-2">
                      <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} disabled={!canSelect} />
                    </td>
                    <td className="py-2 pr-4 text-gray-500 text-xs whitespace-nowrap">{d.oid ?? '-'}</td>
                    <td className="py-2 pr-4 max-w-[220px]">
                      {d.article ? (
                        <a href={`/article/${d.article.id}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline truncate block" title={d.article.title}>
                          {d.article.legacyId ? `${d.article.legacyId} · ` : ''}
                          {d.article.title}
                        </a>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">{d.reporter?.name ?? '미지정'}</td>
                    <td className="py-2 pr-4 text-gray-900 font-medium">
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          image={d.user?.image}
                          seed={d.user?.id || d.user?.email || d.donorName || 'user'}
                          name={d.donorName ?? d.user?.nickname ?? d.user?.name}
                          className="w-7 h-7 text-xs rounded-full object-cover shrink-0"
                        />
                        <span className="whitespace-nowrap">
                          {d.donorName ?? d.user?.nickname ?? d.user?.name ?? '-'}
                          {!d.user && <span className="ml-1 text-xs text-gray-400 font-normal">(비회원)</span>}
                          <span className="block text-xs text-gray-400 font-normal">{d.phone ?? d.user?.email}</span>
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 font-semibold text-gray-900 whitespace-nowrap">{d.amount.toLocaleString()}원</td>
                    <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">
                      {PAY_METHOD_LABELS[d.payMethod] ?? d.payMethod ?? '-'}
                      {d.status !== 'ACTIVE' && <span className="ml-1 text-xs text-red-500">{STATUS_LABELS[d.status] ?? d.status}</span>}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {d.settled ? (
                        <span className="text-xs font-semibold border rounded-lg px-2 py-0.5 bg-gray-50 text-gray-500 border-gray-200">정산완료</span>
                      ) : (
                        <span className="text-xs font-semibold border rounded-lg px-2 py-0.5 bg-brand/10 text-brand border-brand/30">미정산</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-gray-500 text-xs whitespace-nowrap">{fmtDateTime(d.paidAt ?? d.startedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
