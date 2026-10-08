'use client';

import { useEffect, useState } from 'react';

// 후원 금액 5종 고정 — app/api/donations/route.ts의 DONATION_AMOUNTS와 같은 값 (2026-10-08 사장님 확정)
const PRESETS = [3000, 5000, 10000, 20000, 30000];

// 후원(원고료 응원) 폼 — /donate 페이지와 기사 상단 "원고료로 응원하기" 레이어(DonateModal)가 공유하는 핵심 UI/로직 (2026-09-12 분리)
// 2026-10-08: 정기(매월) 후원 폐지 → 일시 후원. 구성은 금액 5종 + 후원자 이름 + 후원자 연락처 + 후원하기.
// 옛 사이트처럼 로그인 없이 후원 가능 — 로그인 상태면 이름만 미리 채워줌.
// 기사에서 열면 그 기사 기자(initialReporterId)에게 가는 후원으로 기록, /donate에서 열면 사이트 전체 후원.
export default function DonateForm({ initialReporterId = '' }: { initialReporterId?: string }) {
  const [amount, setAmount] = useState(5000);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [done, setDone] = useState<{ amount: number } | null>(null); // 방금 후원 완료한 금액 — 감사 화면 표시용

  useEffect(() => {
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => {
        if (me) setName((prev) => prev || me.name || '');
      })
      .catch(() => {});
  }, []);

  async function donate() {
    setErrorMsg('');
    if (!name.trim()) return setErrorMsg('후원자 이름을 입력해주세요.');
    if (!phone.trim()) return setErrorMsg('후원자 연락처를 입력해주세요.');
    setBusy(true);
    const res = await fetch('/api/donations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, name: name.trim(), phone: phone.trim(), reporterId: initialReporterId || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setErrorMsg(data.error ?? '후원 신청에 실패했습니다. 잠시 후 다시 시도해주세요.');
    else setDone({ amount });
    setBusy(false);
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-6">세제혜택(기부금영수증) 없는 단순 후원입니다.</p>

      {done ? (
        <div className="border border-gray-200 rounded-xl p-5 text-center">
          <p className="text-2xl font-bold text-gray-900 mb-1">{done.amount.toLocaleString()}원</p>
          <p className="text-sm text-gray-500 mb-4">후원해주셔서 감사합니다.</p>
          <button
            onClick={() => setDone(null)}
            className="text-sm text-gray-500 border border-gray-200 rounded-lg px-4 py-2 hover:border-brand hover:text-brand"
          >
            한 번 더 후원하기
          </button>
        </div>
      ) : (
        <div>
          {errorMsg && <p className="text-red-600 text-sm mb-3">{errorMsg}</p>}
          <div className="grid grid-cols-5 gap-2 mb-3">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(p)}
                className={`text-sm font-semibold rounded-lg py-2 border ${
                  amount === p ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-700'
                }`}
              >
                {p >= 10000 ? `${p / 10000}만원` : `${p / 1000}천원`}
              </button>
            ))}
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="후원자 이름"
            autoComplete="name"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-brand"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="후원자 연락처"
            inputMode="tel"
            autoComplete="tel"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-brand"
          />
          <button
            onClick={donate}
            disabled={busy}
            className="w-full text-sm font-bold text-white bg-brand rounded-lg py-3 disabled:opacity-50"
          >
            후원하기
          </button>
          <p className="text-xs text-gray-300 mt-3 text-center">
            ※ 결제(KG이니시스) 연동 준비 중 — 지금은 실제 결제 없이 후원 신청만 기록됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
