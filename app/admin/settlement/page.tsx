'use client';

import { useEffect, useState } from 'react';

type SettlementGroup = {
  reporterId: string | null;
  reporterName: string;
  totalAmount: number;
  count: number;
  donationIds: string[];
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthStr() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

// 후원내역 / 기자별 정산 (기능정의서 7.1)
export default function SettlementAdminPage() {
  const [me, setMe] = useState<any>('loading');
  const [start, setStart] = useState(firstOfMonthStr());
  const [end, setEnd] = useState(todayStr());
  const [groups, setGroups] = useState<SettlementGroup[] | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [doneMsg, setDoneMsg] = useState('');

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/me');
      const meData = meRes.ok ? await meRes.json() : null;
      setMe(meData);
    })();
  }, []);

  async function runSettlement() {
    setBusy(true);
    setErrorMsg('');
    setDoneMsg('');
    setGroups(null);
    const res = await fetch(`/api/settlement?start=${start}&end=${end}`);
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error ?? '정산 조회에 실패했습니다.');
    } else {
      setGroups(data);
      setChecked(Object.fromEntries(data.map((g: SettlementGroup) => [g.reporterId ?? '__none__', true])));
    }
    setBusy(false);
  }

  async function completeSelected() {
    if (!groups) return;
    const targetIds = groups
      .filter((g) => checked[g.reporterId ?? '__none__'])
      .flatMap((g) => g.donationIds);
    if (targetIds.length === 0) {
      setErrorMsg('정산 완료 처리할 항목을 선택해주세요.');
      return;
    }
    if (!confirm(`${targetIds.length}건을 정산 완료 처리할까요? 이후에는 다시 선택할 수 없습니다.`)) return;
    setBusy(true);
    setErrorMsg('');
    const res = await fetch('/api/settlement/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ donationIds: targetIds }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error ?? '정산 완료 처리에 실패했습니다.');
    } else {
      setDoneMsg(`${data.updated}건 정산 완료 처리했습니다.`);
      await runSettlement();
    }
    setBusy(false);
  }

  if (me === 'loading') return <main className="max-w-3xl mx-auto px-4 py-10 text-gray-500">불러오는 중…</main>;
  if (!me || me.role !== 'CHIEF_EDITOR') {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-gray-600">편집장만 접근할 수 있습니다.</p>
      </main>
    );
  }

  const totalSelected = (groups ?? [])
    .filter((g) => checked[g.reporterId ?? '__none__'])
    .reduce((sum, g) => sum + g.totalAmount, 0);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">후원내역 / 기자별 정산</h1>

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <p className="text-xs text-gray-400 mb-1">시작일</p>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">종료일</p>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={runSettlement}
          className="text-sm font-bold text-white bg-brand rounded-full px-5 py-2 disabled:opacity-50"
        >
          정산
        </button>
      </div>

      {errorMsg && <p className="text-red-600 text-sm mb-4">{errorMsg}</p>}
      {doneMsg && <p className="text-brand text-sm mb-4">{doneMsg}</p>}

      {groups && (
        <>
          {groups.length === 0 ? (
            <p className="text-sm text-gray-400">해당 기간에 정산 대상 후원 건이 없습니다.</p>
          ) : (
            <>
              <table className="w-full text-sm border-collapse mb-4">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-200">
                    <th className="py-2 pr-2 w-8"></th>
                    <th className="py-2 pr-4">기자</th>
                    <th className="py-2 pr-4">건수</th>
                    <th className="py-2">정산금액</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => {
                    const key = g.reporterId ?? '__none__';
                    return (
                      <tr key={key} className="border-b border-gray-100">
                        <td className="py-2 pr-2">
                          <input
                            type="checkbox"
                            checked={!!checked[key]}
                            onChange={(e) => setChecked((prev) => ({ ...prev, [key]: e.target.checked }))}
                          />
                        </td>
                        <td className="py-2 pr-4 text-gray-900 font-medium">{g.reporterName}</td>
                        <td className="py-2 pr-4 text-gray-500">{g.count}건</td>
                        <td className="py-2 font-semibold text-gray-900">{g.totalAmount.toLocaleString()}원</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  선택 합계: <span className="font-bold text-gray-900">{totalSelected.toLocaleString()}원</span>
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={completeSelected}
                  className="text-sm font-bold text-white bg-brand rounded-full px-5 py-2 disabled:opacity-50"
                >
                  정산 완료 처리
                </button>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
