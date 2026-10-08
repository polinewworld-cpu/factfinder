'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserAvatar } from '@/components/InitialAvatar';

const PAY_METHOD_LABELS: Record<string, string> = {
  Card: '카드',
  CARD: '카드',
  VCard: '카드',
  DirectBank: '계좌이체',
  BANK: '계좌이체',
};

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });

// 한국시간 기준 YYYY-MM-DD
const kstDay = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

type Tab = 'history' | 'settlement';

// 관리자 "후원내역" — 2026-10-08 탭 구성 (사장님 지시)
//  · [후원내역] (기본): 옛 사이트 관리자 "운영관리 > 후원내역" 그대로 — 전체 후원을 건별로, 기간·기자명 검색
//  · [기자별 정산내역]: 기간 안의 후원을 기자별로 묶어 합계·정산완료·미정산, 여러 기자 골라 한 번에 정산 완료
// 옛 /admin/settlement 화면은 이 두 번째 탭으로 합침.
export default function DonationsAdminPage() {
  const [me, setMe] = useState<any>('loading');
  const [tab, setTab] = useState<Tab>('history');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'settlement') setTab('settlement');
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  function switchTab(next: Tab) {
    setTab(next);
    window.history.replaceState(null, '', next === 'settlement' ? '?tab=settlement' : window.location.pathname);
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
      <div className="flex gap-1 border-b border-gray-200 mb-5" role="tablist">
        {(
          [
            ['history', '후원내역'],
            ['settlement', '기자별 정산내역'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => switchTab(key)}
            className={`px-4 py-2 text-sm font-semibold -mb-px border-b-2 ${
              tab === key ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'history' ? <HistoryTab /> : <SettlementTab />}
    </main>
  );
}

// ───────── [후원내역] 전체 후원 건별 목록 ─────────
function HistoryTab() {
  const [donations, setDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reporter, setReporter] = useState('');

  const load = useCallback(async (filters: { from: string; to: string; reporter: string }) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.reporter.trim()) params.set('reporter', filters.reporter.trim());
    const res = await fetch(`/api/admin/donations?${params}`);
    if (res.ok) setDonations(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load({ from: '', to: '', reporter: '' });
  }, [load]);

  const total = useMemo(() => donations.filter((d) => d.status === 'ACTIVE').reduce((s, d) => s + d.amount, 0), [donations]);

  return (
    <>
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

      <p className="text-sm text-gray-500 mb-3">
        {donations.length.toLocaleString()}건 · 결제 합계 <b className="text-gray-900">{total.toLocaleString()}원</b>
      </p>

      {loading ? (
        <p className="text-sm text-gray-400">불러오는 중…</p>
      ) : donations.length === 0 ? (
        <p className="text-sm text-gray-400">후원 내역이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-sm border-collapse min-w-[860px]">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-200 bg-gray-50 whitespace-nowrap">
                <th className="py-2 pl-4 pr-4 font-semibold">주문번호</th>
                <th className="py-2 pr-4 font-semibold">기사</th>
                <th className="py-2 pr-4 font-semibold">기자명</th>
                <th className="py-2 pr-4 font-semibold">후원인</th>
                <th className="py-2 pr-4 font-semibold">후원액</th>
                <th className="py-2 pr-4 font-semibold">결제</th>
                <th className="py-2 pr-4 font-semibold">후원일시</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d) => (
                <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 pl-4 pr-4 text-gray-500 text-xs whitespace-nowrap">{d.oid ?? '-'}</td>
                  <td className="py-2 pr-4 max-w-[240px]">
                    {d.article ? (
                      <a
                        href={`/article/${d.article.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand hover:underline truncate block"
                        title={d.article.title}
                      >
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
                    {d.status === 'CANCELLED' && <span className="ml-1 text-xs text-red-500">취소</span>}
                  </td>
                  <td className="py-2 pr-4 text-gray-500 text-xs whitespace-nowrap">{fmtDateTime(d.paidAt ?? d.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ───────── [기자별 정산내역] 기자별 합계 + 여러 기자 한 번에 정산 완료 ─────────
type SettlementGroup = {
  reporterId: string | null;
  reporterName: string;
  count: number;
  totalAmount: number;
  settledAmount: number;
  unsettledAmount: number;
  unsettledIds: string[];
};

function SettlementTab() {
  const now = new Date();
  const [start, setStart] = useState(kstDay(new Date(now.getFullYear(), now.getMonth(), 1, 12)));
  const [end, setEnd] = useState(kstDay(now));
  const [groups, setGroups] = useState<SettlementGroup[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const keyOf = (g: SettlementGroup) => g.reporterId ?? '__none__';

  const load = useCallback(async (s: string, e: string) => {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/settlement?start=${s}&end=${e}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({ ok: false, text: data.error ?? '정산 조회에 실패했습니다.' });
      setGroups([]);
    } else {
      setGroups(data);
      setChecked(new Set());
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    load(start, end);
    // 처음 열 때 이번 달로 한 번 조회
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const selectable = (groups ?? []).filter((g) => g.unsettledIds.length > 0);
  const allChecked = selectable.length > 0 && selectable.every((g) => checked.has(keyOf(g)));
  const selected = (groups ?? []).filter((g) => checked.has(keyOf(g)));
  const selectedAmount = selected.reduce((s, g) => s + g.unsettledAmount, 0);
  const sum = (k: 'count' | 'totalAmount' | 'settledAmount' | 'unsettledAmount') => (groups ?? []).reduce((s, g) => s + g[k], 0);

  function toggle(g: SettlementGroup) {
    setChecked((prev) => {
      const next = new Set(prev);
      const k = keyOf(g);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function completeSelected() {
    const donationIds = selected.flatMap((g) => g.unsettledIds);
    if (donationIds.length === 0) return;
    if (!confirm(`기자 ${selected.length}명, ${donationIds.length}건(${selectedAmount.toLocaleString()}원)을 정산 완료로 바꿀까요?`)) return;
    setBusy(true);
    const res = await fetch('/api/settlement/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ donationIds }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMessage({ ok: false, text: data.error ?? '정산 완료 처리에 실패했습니다.' });
    await load(start, end);
    setMessage({ ok: true, text: `${data.updated}건 정산 완료 처리했습니다.` });
  }

  return (
    <>
      <form
        className="flex flex-wrap items-center gap-2 mb-4 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          load(start, end);
        }}
      >
        <span className="text-gray-500">기간</span>
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5" />
        <span className="text-gray-400">~</span>
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5" />
        <button type="submit" disabled={busy} className="border border-gray-300 rounded-lg px-4 py-1.5 font-semibold text-gray-700 hover:bg-gray-50">
          조회
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-sm">
        <p className={message?.ok ? 'text-brand' : 'text-red-600'}>{message?.text}</p>
        <button
          type="button"
          onClick={completeSelected}
          disabled={busy || selected.length === 0}
          className="rounded-lg px-4 py-1.5 font-semibold text-white bg-brand disabled:opacity-40"
        >
          {selected.length > 0 ? `선택한 기자 ${selected.length}명 정산 완료 (${selectedAmount.toLocaleString()}원)` : '정산 완료 처리'}
        </button>
      </div>

      {groups === null ? (
        <p className="text-sm text-gray-400">불러오는 중…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-400">해당 기간에 결제된 후원이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-sm border-collapse min-w-[640px]">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-200 bg-gray-50 whitespace-nowrap">
                <th className="py-2 pl-4 pr-2 w-8">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    disabled={selectable.length === 0}
                    onChange={() => setChecked(allChecked ? new Set() : new Set(selectable.map(keyOf)))}
                    title="미정산 있는 기자 전체 선택"
                  />
                </th>
                <th className="py-2 pr-4 font-semibold">기자</th>
                <th className="py-2 pr-4 font-semibold text-right">건수</th>
                <th className="py-2 pr-4 font-semibold text-right">후원 합계</th>
                <th className="py-2 pr-4 font-semibold text-right">정산완료</th>
                <th className="py-2 pr-4 font-semibold text-right">미정산</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={keyOf(g)} className={`border-b border-gray-100 ${checked.has(keyOf(g)) ? 'bg-brand/5' : 'hover:bg-gray-50'}`}>
                  <td className="py-2 pl-4 pr-2">
                    <input type="checkbox" checked={checked.has(keyOf(g))} disabled={g.unsettledIds.length === 0} onChange={() => toggle(g)} />
                  </td>
                  <td className="py-2 pr-4 text-gray-900 font-medium">{g.reporterName}</td>
                  <td className="py-2 pr-4 text-right text-gray-600">{g.count.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right font-semibold text-gray-900">{g.totalAmount.toLocaleString()}원</td>
                  <td className="py-2 pr-4 text-right text-gray-500">{g.settledAmount.toLocaleString()}원</td>
                  <td className={`py-2 pr-4 text-right font-semibold ${g.unsettledAmount ? 'text-brand' : 'text-gray-300'}`}>
                    {g.unsettledAmount.toLocaleString()}원
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td />
                <td className="py-2 pr-4 text-gray-700">합계</td>
                <td className="py-2 pr-4 text-right text-gray-700">{sum('count').toLocaleString()}</td>
                <td className="py-2 pr-4 text-right text-gray-900">{sum('totalAmount').toLocaleString()}원</td>
                <td className="py-2 pr-4 text-right text-gray-500">{sum('settledAmount').toLocaleString()}원</td>
                <td className="py-2 pr-4 text-right text-brand">{sum('unsettledAmount').toLocaleString()}원</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
