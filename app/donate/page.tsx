'use client';

import { useEffect, useState } from 'react';

const PRESETS = [1000, 5000, 10000, 30000];

export default function DonatePage() {
  const [me, setMe] = useState<any>('loading');
  const [active, setActive] = useState<any>(null);
  const [amount, setAmount] = useState<number | ''>(5000);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function load() {
    const meRes = await fetch('/api/me');
    if (!meRes.ok) return setMe(null);
    setMe(await meRes.json());
    const dRes = await fetch('/api/donations');
    if (dRes.ok) setActive(await dRes.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function subscribe() {
    setErrorMsg('');
    const finalAmount = custom ? Number(custom) : amount;
    if (!finalAmount || finalAmount < 1000) return setErrorMsg('최소 1,000원부터 후원할 수 있습니다.');
    setBusy(true);
    const res = await fetch('/api/donations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: finalAmount }),
    });
    const data = await res.json();
    if (!res.ok) setErrorMsg(data.error);
    else await load();
    setBusy(false);
  }

  async function cancel() {
    if (!active) return;
    setBusy(true);
    await fetch(`/api/donations/${active.id}/cancel`, { method: 'POST' });
    await load();
    setBusy(false);
  }

  if (me === 'loading') return <main className="max-w-md mx-auto px-4 py-10 text-gray-500">불러오는 중…</main>;
  if (!me) {
    return (
      <main className="max-w-md mx-auto px-4 py-10">
        <p className="text-gray-600">
          후원하려면 로그인해주세요.{' '}
          <a href="/api/auth/signin/google" className="text-brand font-semibold">
            구글로 로그인
          </a>
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-xl font-bold text-gray-900 mb-2">팩트파인더 정기후원</h1>
      <p className="text-xs text-gray-400 mb-6">
        세제혜택(기부금영수증) 없는 단순 후원 구독입니다. 언제든 해지할 수 있습니다.
      </p>

      {active ? (
        <div className="border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500 mb-1">현재 후원 중</p>
          <p className="text-2xl font-bold text-gray-900 mb-1">
            👑 월 {active.amount.toLocaleString()}원
          </p>
          <p className="text-xs text-gray-400 mb-4">{new Date(active.startedAt).toLocaleDateString('ko-KR')}부터</p>
          <button
            onClick={cancel}
            disabled={busy}
            className="text-sm text-gray-500 border border-gray-200 rounded-full px-4 py-2 hover:border-red-400 hover:text-red-500"
          >
            후원 해지
          </button>
        </div>
      ) : (
        <div>
          {errorMsg && <p className="text-red-600 text-sm mb-3">{errorMsg}</p>}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setAmount(p);
                  setCustom('');
                }}
                className={`text-sm font-semibold rounded-lg py-2 border ${
                  amount === p && !custom ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-700'
                }`}
              >
                {p.toLocaleString()}
              </button>
            ))}
          </div>
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="직접 입력 (원)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-brand"
          />
          <button
            onClick={subscribe}
            disabled={busy}
            className="w-full text-sm font-bold text-white bg-brand rounded-full py-3 disabled:opacity-50"
          >
            매월 {(custom ? Number(custom) : amount || 0).toLocaleString()}원 정기후원 시작하기
          </button>
          <p className="text-[11px] text-gray-300 mt-3 text-center">
            ※ 결제대행사(PG) 연동 준비 중 — 지금은 결제 없이 후원 상태만 시작됩니다.
          </p>
        </div>
      )}
    </main>
  );
}
