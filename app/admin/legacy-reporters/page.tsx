'use client';

import AdminTabs, { PEOPLE_TABS } from '@/components/AdminTabs';
import { useEffect, useState } from 'react';

type Legacy = { id: string; name: string; claimEmail: string | null; articleCount: number };
type Member = { id: string; name: string; nickname: string | null; email: string; role: string };

// 옛 기자 계정 연결 (2026-10-08) — 옛 사이트 기자가 2.0에 구글로 가입하면, 여기서 그 사람의 옛 기사를 새 계정으로 옮김
export default function LegacyReportersPage() {
  const [data, setData] = useState<{ legacy: Legacy[]; members: Member[] } | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [emails, setEmails] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetch('/api/admin/legacy-reporters');
    if (!res.ok) return;
    const d: { legacy: Legacy[]; members: Member[] } = await res.json();
    setData(d);
    setEmails(Object.fromEntries(d.legacy.map((l) => [l.id, l.claimEmail ?? ''])));
    // 이름이 같은 가입 회원이 딱 한 명이면 미리 골라 둠 — 자동 연결은 하지 않음(동명이인 가능)
    setPick((prev) => {
      const next = { ...prev };
      for (const l of d.legacy) {
        if (next[l.id]) continue;
        const same = d.members.filter((m) => (m.nickname ?? '').trim() === l.name || m.name.trim() === l.name);
        if (same.length === 1) next[l.id] = same[0].id;
      }
      return next;
    });
  }

  // 구글 이메일 미리 등록 — 그 이메일로 처음 로그인하면 옛 기사·기자 등급이 자동 승계됨
  async function saveEmail(l: Legacy) {
    setBusy(l.id);
    const res = await fetch('/api/admin/legacy-reporters', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: l.id, claimEmail: emails[l.id] ?? '' }),
    });
    const r = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) setMessage(r.error ?? '저장에 실패했습니다.');
    else if (r.linkedNow) setMessage(`${l.name}: 이미 가입한 회원이라 바로 연결했습니다 (기사 ${r.moved}건).`);
    else setMessage(emails[l.id] ? `${l.name}: ${emails[l.id]} 로 로그인하면 자동으로 승계됩니다.` : `${l.name}: 등록 이메일을 지웠습니다.`);
    await load();
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

  async function remove(l: Legacy) {
    // 2026-10-10: 삭제 = 영구 삭제(되살리기 없음). 옛 기사엔 기자 이름만 그대로 남음
    if (!confirm(l.articleCount > 0
      ? `옛 기자 "${l.name}"을(를) 영구히 삭제할까요?

옛 기사 ${l.articleCount.toLocaleString()}건에는 기자 이름만 그대로 남고, 이 목록과 연결 기능에서는 다시 볼 수 없습니다.`
      : `옛 기자 "${l.name}"을(를) 영구히 삭제할까요?`)) return;
    setBusy(l.id);
    const res = await fetch(`/api/admin/legacy-reporters?id=${l.id}`, { method: 'DELETE' });
    const r = await res.json().catch(() => ({}));
    setBusy(null);
    setMessage(res.ok ? `${l.name}을(를) 삭제했습니다.` : r.error ?? '삭제에 실패했습니다.');
    if (res.ok) await load();
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <AdminTabs title="회원/기자관리" tabs={PEOPLE_TABS} />
      <p className="text-sm text-gray-500 mb-5">
        옛 사이트 기사는 로그인할 수 없는 임시 기자 이름으로 들어와 있습니다. <b>기자의 구글 이메일을 미리 등록</b>해 두면 그 사람이
        처음 로그인할 때 옛 기사와 기자 등급이 자동으로 이어집니다. 이미 가입한 사람은 계정을 골라 [연결]을 누르세요(이름이 같은 회원은
        미리 골라 둡니다). 연결하면 독자 등급은 기자로 올라갑니다.
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
                <th className="py-2 pr-4 font-semibold">구글 이메일 미리 등록</th>
                <th className="py-2 pr-4 font-semibold">이미 가입했으면 계정 선택</th>
                <th className="py-2 pr-4 whitespace-nowrap" />
              </tr>
            </thead>
            <tbody>
              {data.legacy.map((l) => (
                <tr key={l.id} className="border-b border-gray-100">
                  <td className="py-2 pl-4 pr-4 font-medium text-gray-900 whitespace-nowrap">{l.name}</td>
                  <td className="py-2 pr-4 text-right text-gray-600">{l.articleCount.toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={emails[l.id] ?? ''}
                        onChange={(e) => setEmails((p) => ({ ...p, [l.id]: e.target.value }))}
                        placeholder="example@gmail.com"
                        className="w-44 border border-gray-200 rounded-lg px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        disabled={busy === l.id || (emails[l.id] ?? '') === (l.claimEmail ?? '')}
                        onClick={() => saveEmail(l)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs whitespace-nowrap disabled:opacity-40"
                      >
                        저장
                      </button>
                    </div>
                    {l.claimEmail && <p className="text-[11px] text-gray-400 mt-0.5">로그인 대기 중</p>}
                  </td>
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
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <button
                      type="button"
                      disabled={!pick[l.id] || busy === l.id}
                      onClick={() => connect(l)}
                      className="rounded-lg px-3 py-1 text-xs font-semibold text-white bg-brand disabled:opacity-40"
                    >
                      연결
                    </button>
                    {/* 삭제 = 유령 계정: 목록에서만 숨기고 옛 기사·이름은 유지 (2026-10-08) */}
                    <button
                      type="button"
                      disabled={busy === l.id}
                      onClick={() => remove(l)}
                      title="영구 삭제 — 옛 기사엔 기자 이름만 남음"
                      className="ml-2 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-500 hover:text-red-600 hover:border-red-300 disabled:opacity-40"
                    >
                      삭제
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
