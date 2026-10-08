'use client';

import { useEffect, useState } from 'react';

type Legacy = { id: string; name: string; articleCount: number };
type Member = { id: string; name: string; nickname: string | null; email: string; role: string };

// 옛 기자 계정 연결 (2026-10-08) — 옛 사이트 기자가 2.0에 구글로 가입하면, 여기서 그 사람의 옛 기사를 새 계정으로 옮김
export default function LegacyReportersPage() {
  const [data, setData] = useState<{ legacy: Legacy[]; members: Member[] } | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function load() {
    const res = await fetch('/api/admin/legacy-reporters');
    if (res.ok) setData(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  async function connect(l: Legacy) {
    const targetId = pick[l.id];
    const target = data?.members.find((m) => m.id === targetId);
    if (!target) return;
    if (!confirm(`옛 기자 "${l.name}"의 기사 ${l.articleCount.toLocaleString()}건을\n${target.nickname ?? target.name} (${target.email}) 계정으로 옮길까요?`)) return;
    setBusy(l.id);
    const res = await fetch('/api/admin/legacy-reporters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ legacyId: l.id, targetId }),
    });
    const r = await res.json().catch(() => ({}));
    setBusy(null);
    setMessage(res.ok ? `${l.name} → ${target.nickname ?? target.name}: 기사 ${r.moved}건을 옮겼습니다.` : r.error ?? '연결에 실패했습니다.');
    if (res.ok) await load();
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-2">옛 기자 계정 연결</h1>
      <p className="text-sm text-gray-500 mb-5">
        옛 사이트 기사는 로그인할 수 없는 임시 기자 이름으로 들어와 있습니다. 해당 기자가 2.0에 구글로 가입하면, 여기서 실제 계정을
        골라 [연결]을 누르세요. 그 기자의 옛 기사가 모두 새 계정으로 옮겨집니다.
      </p>
      {message && <p className="text-sm text-brand mb-3">{message}</p>}
      {!data ? (
        <p className="text-sm text-gray-400">불러오는 중…</p>
      ) : data.legacy.length === 0 ? (
        <p className="text-sm text-gray-400">연결할 옛 기자가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-200 bg-gray-50 whitespace-nowrap">
                <th className="py-2 pl-4 pr-4 font-semibold">옛 기자</th>
                <th className="py-2 pr-4 font-semibold text-right">기사</th>
                <th className="py-2 pr-4 font-semibold">연결할 실제 계정</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {data.legacy.map((l) => (
                <tr key={l.id} className="border-b border-gray-100">
                  <td className="py-2 pl-4 pr-4 font-medium text-gray-900 whitespace-nowrap">{l.name}</td>
                  <td className="py-2 pr-4 text-right text-gray-600">{l.articleCount.toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <select
                      value={pick[l.id] ?? ''}
                      onChange={(e) => setPick((p) => ({ ...p, [l.id]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                    >
                      <option value="">— 가입한 회원 선택 —</option>
                      {data.members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nickname ?? m.name} ({m.email})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      disabled={!pick[l.id] || busy === l.id}
                      onClick={() => connect(l)}
                      className="rounded-lg px-3 py-1 text-xs font-semibold text-white bg-brand disabled:opacity-40"
                    >
                      연결
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
