'use client';

import AdminTabs, { PEOPLE_TABS } from '@/components/AdminTabs';
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

  // 회원 삭제 — 확인창 한 번. 쓴 기사가 있으면 유령 계정(목록에서만 숨김, 기사·이름 유지) (2026-10-08)
  async function deleteUser(u: any) {
    if (!confirm(`${u.name} 회원을 삭제할까요?
쓴 기사가 있으면 목록에서만 사라지고 기사와 이름은 그대로 남습니다.`)) return;
    setBusyId(u.id);
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? '삭제에 실패했습니다.');
    } else {
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    }
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

  // 2026-10-09: 기자관리 = 로그인하는 실제 기자·논설위원·편집장 전부(등급이 REPORTER인 것만 보이던 문제).
  // 옛 사이트 임시 계정·외부 기고자(…@legacy.invalid)는 [유령기자] 탭에서 관리 — 여기 두 목록에선 뺌
  const realUsers = users.filter((u) => !String(u.email ?? '').endsWith('@legacy.invalid'));
  const shownUsers = roleFilter ? realUsers.filter((u) => ['REPORTER', 'COLUMNIST', 'CHIEF_EDITOR'].includes(u.role)) : realUsers;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <AdminTabs title="회원/기자관리" tabs={PEOPLE_TABS} />
      <p className="text-sm text-gray-500 mb-3">{roleFilter ? `기자·논설위원·편집장 ${shownUsers.length}명 (외부 기고자·옛 기자는 [유령기자] 탭)` : `전체 회원 ${realUsers.length}명`}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-200">
              <th className="py-2 pr-4">이름</th>
              <th className="py-2 pr-4">이메일</th>
              <th className="py-2 pr-4 whitespace-nowrap">등급</th>
              <th className="py-2 whitespace-nowrap">변경</th>
            </tr>
          </thead>
          <tbody>
            {shownUsers.map((u) => (
              <tr key={u.id} className="border-b border-gray-100">
                <td className="py-2 pr-4 text-gray-900 font-medium whitespace-nowrap">{u.name}</td>
                <td className="py-2 pr-4 text-gray-500 break-all">{u.email}</td>
                <td className="py-2 pr-4 text-gray-700 whitespace-nowrap">
                  {ROLE_LABELS[u.role] ?? u.role}
                  {u.reporterApplicationStatus === 'PENDING' && (
                    <span className="ml-1.5 text-xs font-semibold text-brand">(기자신청중)</span>
                  )}
                  {u.reporterApplicationStatus === 'REJECTED' && (
                    <span className="ml-1.5 text-xs text-gray-400">(신청반려)</span>
                  )}
                </td>
                <td className="py-2 whitespace-nowrap">
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
                  <button
                    type="button"
                    disabled={busyId === u.id || u.id === me.id}
                    onClick={() => deleteUser(u)}
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
    </main>
  );
}
