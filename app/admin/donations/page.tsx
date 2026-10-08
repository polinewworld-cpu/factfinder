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

type Tab = 'history' | 'settlement';

// 관리자 "후원내역" — 2026-10-08 탭 구성 (사장님 지시)
//  · [후원내역] (기본): 옛 사이트 관리자 "운영관리 > 후원내역" 그대로 — 전체 후원을 건별로, 기간·기자명 검색
//  · [기자별 정산내역]: 미정산 후원 전체 체크 → 기자별 합계·30% 공제·지급액 확인 → 정산 완료
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

// ───────── [기자별 정산내역] ─────────
// 정산하는 날: 미정산 후원이 전부 체크된 채로 나오고, 체크한 건 기준 기자별 합계·30% 공제·지급액(70%)을 보여줌.
// [정산 완료]를 누르면 체크한 건이 정산완료로 바뀜. 정산완료 건은 회색으로 구분·체크 불가 (2026-10-08 사장님 지시)
const FEE_RATE = 0.3; // 정산 시 공제 비율 30%

function SettlementTab() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showSettled, setShowSettled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async (f: string, t: string) => {
    setRows(null);
    const params = new URLSearchParams();
    if (f) params.set('from', f);
    if (t) params.set('to', t);
    const res = await fetch(`/api/admin/donations?${params}`);
    const data: any[] = res.ok ? await res.json() : [];
    // 결제 완료 건만, 미정산을 위로
    const paid = data.filter((d) => d.status === 'ACTIVE').sort((a, b) => Number(a.settled) - Number(b.settled));
    setRows(paid);
    setChecked(new Set(paid.filter((d) => !d.settled).map((d) => d.id))); // 미정산은 처음부터 전부 체크
  }, []);

  useEffect(() => {
    load('', '');
  }, [load]);

  const unsettled = (rows ?? []).filter((d) => !d.settled);
  const visible = (rows ?? []).filter((d) => showSettled || !d.settled);
  const allChecked = unsettled.length > 0 && unsettled.every((d) => checked.has(d.id));

  // 체크한 건 기준 기자별 집계
  const summary = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>();
    for (const d of rows ?? []) {
      if (!checked.has(d.id)) continue;
      const key = d.reporter?.id ?? '__none__';
      const g = map.get(key) ?? { name: d.reporter?.name ?? '미지정 (사이트 전체 후원)', count: 0, total: 0 };
      g.count += 1;
      g.total += d.amount;
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [rows, checked]);
  const sumCount = summary.reduce((s, g) => s + g.count, 0);
  const sumTotal = summary.reduce((s, g) => s + g.total, 0);
  const fee = (n: number) => Math.round(n * FEE_RATE);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function complete() {
    if (checked.size === 0) return;
    const payout = (sumTotal - fee(sumTotal)).toLocaleString();
    if (!confirm(`${sumCount}건 · 후원 ${sumTotal.toLocaleString()}원 · 지급 ${payout}원\n정산 완료로 바꿀까요?`)) return;
    setBusy(true);
    const res = await fetch('/api/settlement/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ donationIds: [...checked] }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMessage({ ok: false, text: data.error ?? '정산 완료 처리에 실패했습니다.' });
    setMessage({ ok: true, text: `${data.updated}건 정산 완료 처리했습니다.` });
    await load(from, to);
  }

  return (
    <>
      <form
        className="flex flex-wrap items-center gap-2 mb-4 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          load(from, to);
        }}
      >
        <span className="text-gray-500">기간</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5" />
        <span className="text-gray-400">~</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5" />
        <button type="submit" className="border border-gray-300 rounded-lg px-4 py-1.5 font-semibold text-gray-700 hover:bg-gray-50">
          조회
        </button>
        <label className="flex items-center gap-1.5 text-gray-500 ml-2">
          <input type="checkbox" checked={showSettled} onChange={(e) => setShowSettled(e.target.checked)} />
          정산완료 건도 보기
        </label>
      </form>

      {/* 체크한 건 기준 기자별 정산 요약 */}
      <div className="border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-sm font-bold text-gray-900">
            정산 대상 {sumCount.toLocaleString()}건
            <span className="ml-2 font-normal text-gray-400">(체크한 건 기준 · 30% 공제)</span>
          </p>
          <button
            type="button"
            onClick={complete}
            disabled={busy || checked.size === 0}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white bg-brand disabled:opacity-40"
          >
            정산 완료
          </button>
        </div>
        {message && <p className={`text-sm mb-2 ${message.ok ? 'text-brand' : 'text-red-600'}`}>{message.text}</p>}
        {summary.length === 0 ? (
          <p className="text-sm text-gray-400">체크된 미정산 후원이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-200 whitespace-nowrap">
                <th className="py-1.5 pr-4 font-semibold">기자</th>
                <th className="py-1.5 pr-4 font-semibold text-right">건수</th>
                <th className="py-1.5 pr-4 font-semibold text-right">후원 합계</th>
                <th className="py-1.5 pr-4 font-semibold text-right">공제(30%)</th>
                <th className="py-1.5 font-semibold text-right">지급액</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((g) => (
                <tr key={g.name} className="border-b border-gray-100">
                  <td className="py-1.5 pr-4 text-gray-900 font-medium">{g.name}</td>
                  <td className="py-1.5 pr-4 text-right text-gray-600">{g.count}</td>
                  <td className="py-1.5 pr-4 text-right text-gray-900">{g.total.toLocaleString()}원</td>
                  <td className="py-1.5 pr-4 text-right text-gray-400">-{fee(g.total).toLocaleString()}원</td>
                  <td className="py-1.5 text-right font-bold text-brand">{(g.total - fee(g.total)).toLocaleString()}원</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1.5 pr-4 text-gray-700">합계</td>
                <td className="py-1.5 pr-4 text-right text-gray-700">{sumCount}</td>
                <td className="py-1.5 pr-4 text-right text-gray-900">{sumTotal.toLocaleString()}원</td>
                <td className="py-1.5 pr-4 text-right text-gray-400">-{fee(sumTotal).toLocaleString()}원</td>
                <td className="py-1.5 text-right text-brand">{(sumTotal - fee(sumTotal)).toLocaleString()}원</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {rows === null ? (
        <p className="text-sm text-gray-400">불러오는 중…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-400">결제된 후원이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-sm border-collapse min-w-[760px]">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-200 bg-gray-50 whitespace-nowrap">
                <th className="py-2 pl-4 pr-2 w-8">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    disabled={unsettled.length === 0}
                    onChange={() => setChecked(allChecked ? new Set() : new Set(unsettled.map((d) => d.id)))}
                    title="미정산 전체 선택"
                  />
                </th>
                <th className="py-2 pr-4 font-semibold">기자명</th>
                <th className="py-2 pr-4 font-semibold">기사</th>
                <th className="py-2 pr-4 font-semibold">후원인</th>
                <th className="py-2 pr-4 font-semibold text-right">후원액</th>
                <th className="py-2 pr-4 font-semibold">후원일시</th>
                <th className="py-2 pr-4 font-semibold">정산</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((d) => (
                <tr
                  key={d.id}
                  className={`border-b border-gray-100 ${
                    d.settled ? 'bg-gray-100 text-gray-400' : checked.has(d.id) ? 'bg-brand/5' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="py-2 pl-4 pr-2">
                    <input type="checkbox" checked={!d.settled && checked.has(d.id)} disabled={d.settled} onChange={() => toggle(d.id)} />
                  </td>
                  <td className={`py-2 pr-4 whitespace-nowrap ${d.settled ? '' : 'text-gray-900 font-medium'}`}>{d.reporter?.name ?? '미지정'}</td>
                  <td className="py-2 pr-4 max-w-[220px] truncate" title={d.article?.title}>
                    {d.article ? `${d.article.legacyId ? `${d.article.legacyId} · ` : ''}${d.article.title}` : '-'}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">{d.donorName ?? d.user?.nickname ?? d.user?.name ?? '-'}</td>
                  <td className={`py-2 pr-4 text-right whitespace-nowrap ${d.settled ? '' : 'font-semibold text-gray-900'}`}>
                    {d.amount.toLocaleString()}원
                  </td>
                  <td className="py-2 pr-4 text-xs whitespace-nowrap">{fmtDateTime(d.paidAt ?? d.startedAt)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {d.settled ? (
                      <span className="text-xs font-semibold border rounded-lg px-2 py-0.5 bg-gray-200 text-gray-500 border-gray-300">
                        정산완료
                        {d.settledAt ? ` ${new Date(d.settledAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}` : ''}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold border rounded-lg px-2 py-0.5 bg-brand/10 text-brand border-brand/30">미정산</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
