'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// 2026-09-22: 회원/후원회원 구별 폐지(후원 여부는 role이 아니라 isDonor로만 표시) — DONOR_READER는
// 더 이상 새로 부여하지 않지만, 과거 데이터에 남아있을 경우 라벨은 표시할 수 있게 유지
const ROLE_LABELS: Record<string, string> = {
  READER: '독자',
  DONOR_READER: '후원독자',
  REPORTER: '기자',
  COLUMNIST: '논설위원',
  CHIEF_EDITOR: '편집장',
};

// 관리자가 직접 지정 가능한 등급 — DONOR_READER는 제외
const ASSIGNABLE_ROLES = ['READER', 'REPORTER', 'COLUMNIST', 'CHIEF_EDITOR'];

export default function MembersAdminPage() {
  const searchParams = useSearchParams();
  // 관리자 대시보드 "기자관리"에서 ?role=REPORTER 로 진입 — 회원 관리 화면을 재사용해 필터만 적용 (2026-09-11 신설)
  const roleFilter = searchParams.get('role');
  const [me, setMe] = useState<any>('loading');
  const [users, setUsers] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/users');
    if (res.ok) setUsers(await res.json());
  }

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/me');
      const meData = meRes.ok ? await meRes.json() : null;
      setMe(meData);
      if (meData?.role === 'CHIEF_EDITOR') await load();
    })();
  }, []);

  async function changeRole(id: string, role: string) {
    setBusyId(id);
    await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    await load();
    setBusyId(null);
  }

  if (me === 'loading') return <main className="max-w-3xl mx-auto px-4 py-10 text-gray-500">불러오는 중…</main>;
  if (!me || me.role !== 'CHIEF_EDITOR') {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-gray-600">편집장만 접근할 수 있습니다.</p>
      </main>
    );
  }

  const shownUsers = roleFilter ? users.filter((u) => u.role === roleFilter) : users;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">
        {roleFilter ? `기자관리 (${shownUsers.length})` : `회원 관리 (${users.length})`}
      </h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-200">
              <th className="py-2 pr-4">이름</th>
              <th className="py-2 pr-4">이메일</th>
              <th className="py-2 pr-4">등급</th>
              <th className="py-2">변경</th>
            </tr>
          </thead>
          <tbody>
            {shownUsers.map((u) => (
              <tr key={u.id} className="border-b border-gray-100">
                <td className="py-2 pr-4 text-gray-900 font-medium">{u.name}</td>
                <td className="py-2 pr-4 text-gray-500">{u.email}</td>
                <td className="py-2 pr-4 text-gray-700">
                  {ROLE_LABELS[u.role] ?? u.role}
                  {u.reporterApplicationStatus === 'PENDING' && (
                    <span className="ml-1.5 text-xs font-semibold text-brand">(기자신청중)</span>
                  )}
                  {u.reporterApplicationStatus === 'REJECTED' && (
                    <span className="ml-1.5 text-xs text-gray-400">(신청반려)</span>
                  )}
                </td>
                <td className="py-2">
                  <select
                    value={u.role}
                    disabled={busyId === u.id}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
                  >
                    {ASSIGNABLE_ROLES.map((value) => (
                      <option key={value} value={value}>
                        {ROLE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
