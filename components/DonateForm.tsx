'use client';

import { useEffect, useState } from 'react';

const PRESETS = [1000, 5000, 10000, 30000];

type Reporter = { id: string; name: string; nickname: string | null };

// 정기후원 신청 폼 — /donate 페이지와 기사 상단 "원고료로 응원하기" 레이어(DonateModal)가 공유하는 핵심 UI/로직 (2026-09-12 분리)
export default function DonateForm({ initialReporterId = '' }: { initialReporterId?: string }) {
  const [me, setMe] = useState<any>('loading');
  const [active, setActive] = useState<any>(null);
  const [amount, setAmount] = useState<number | ''>(5000);
  const [custom, setCustom] = useState('');
  const [phone, setPhone] = useState('');
  const [reporters, setReporters] = useState<Reporter[]>([]);
  const [reporterId, setReporterId] = useState(initialReporterId);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function load() {
    const meRes = await fetch('/api/me');
    if (!meRes.ok) return setMe(null);
    setMe(await meRes.json());
    const dRes = await fetch('/api/donations');
    if (dRes.ok) setActive(await dRes.json());
    const rRes = await fetch('/api/reporters');
    if (rRes.ok) setReporters(await rRes.json());
  }

  useEffect(() => {
    load();
  }, []);

  // 기사 상단 "원고료로 응원하기" 레이어에서 특정 기자를 지정하고 열었을 경우 자동 선택 (2026-09-12)
  useEffect(() => {
    if (initialReporterId) setReporterId(initialReporterId);
  }, [initialReporterId]);

  async function subscribe() {
    setErrorMsg('');
    const finalAmount = custom ? Number(custom) : amount;
    if (!finalAmount || finalAmount < 1000) return setErrorMsg('최소 1,000원부터 후원할 수 있습니다.');
    if (!phone.trim()) return setErrorMsg('연락처(전화번호)를 입력해주세요.');
    setBusy(true);
    const res = await fetch('/api/donations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: finalAmount, phone: phone.trim(), reporterId: reporterId || null }),
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

  if (me === 'loading') return <p className="text-gray-500 text-sm py-6 text-center">불러오는 중…</p>;
  if (!me) {
    return (
      <p className="text-gray-600 text-sm">
        후원하려면 로그인해주세요.{' '}
        <a href="/api/auth/signin/google" className="text-brand font-semibold">
          구글로 로그인
        </a>
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-6">
        세제혜택(기부금영수증) 없는 단순 후원 구독입니다. 언제든 해지할 수 있습니다.
      </p>

      {active ? (
        <div className="border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500 mb-1">현재 후원 중</p>
          <p className="text-2xl font-bold text-gray-900 mb-1">
            👑 월 {active.amount.toLocaleString()}원
          </p>
          <p className="text-xs text-gray-400 mb-1">{new Date(active.startedAt).toLocaleDateString('ko-KR')}부터</p>
          {active.reporter && (
            <p className="text-xs text-gray-400 mb-4">{active.reporter.nickname ?? active.reporter.name} 기자 응원 중</p>
          )}
          {!active.reporter && <div className="mb-4" />}
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
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-brand"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="연락처(전화번호)"
            inputMode="tel"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-brand"
          />
          {/* 특정 기사의 "원고료로 응원하기"에서 열린 경우(initialReporterId 있음)엔 이미 그 기사를 쓴 기자로 고정되므로
              별도 선택 UI를 노출하지 않음 — /donate 페이지에서 기사 맥락 없이 들어온 경우에만 선택지를 보여줌 (2026-09-12) */}
          {!initialReporterId && reporters.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-1">특정 기자 응원하기 (선택)</p>
              <select
                value={reporterId}
                onChange={(e) => setReporterId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
              >
                <option value="">사이트 전체 후원 (지정 안 함)</option>
                {reporters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nickname ?? r.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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
    </div>
  );
}
