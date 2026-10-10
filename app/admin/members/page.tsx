'use client';

import AdminTabs, { PEOPLE_TABS } from '@/components/AdminTabs';
import { useEffect, useRef, useState } from 'react';
import { compressImageFile } from '@/lib/imageCompress';
import { useSearchParams } from 'next/navigation';
import { closeOnBackdrop } from '@/lib/backdrop';

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

// 회원 편집 창 (2026-10-09) — 닉네임(바이라인에 쓰임)·프로필 사진·자기소개·원고료 정산 계좌
function EditMember({ user, onClose, onSaved }: { user: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    nickname: user.nickname ?? user.name ?? '',
    image: user.image ?? '',
    bio: user.bio ?? '',
    bankName: user.bankName ?? '',
    bankAccount: user.bankAccount ?? '',
    accountHolder: user.accountHolder ?? '',
  });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  // 닉네임을 숨긴 옛 기자 계정이 쓰고 있을 때 — 같은 사람이면 합쳐서 옛 기사와 이름을 이 회원에게 (2026-10-10)
  const [conflict, setConflict] = useState<{ id: string; name: string; legacy: boolean; articleCount: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const input = 'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-brand bg-white';

  async function upload(file?: File) {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', await compressImageFile(file));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(d.error ?? '사진 업로드 실패');
    setF((x) => ({ ...x, image: d.url }));
  }
  async function save() {
    setBusy(true);
    setMsg('');
    setConflict(null);
    const res = await fetch(`/api/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error ?? '저장 실패');
      if (d.conflict?.legacy) setConflict(d.conflict);
      return;
    }
    onSaved();
    onClose();
  }
  async function mergeLegacy() {
    if (!conflict) return;
    if (!confirm(`옛 기자 "${conflict.name}"이(가) 이 회원(${user.email})과 같은 사람인가요?

합치면 옛 기사 ${conflict.articleCount.toLocaleString()}건이 이 회원 것으로 옮겨지고, "${conflict.name}" 이름을 이 회원 닉네임으로 쓸 수 있습니다.`)) return;
    setBusy(true);
    const res = await fetch('/api/admin/legacy-reporters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ legacyId: conflict.id, targetId: user.id }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(d.error ?? '합치기 실패');
    setConflict(null);
    setMsg('');
    await save(); // 이름이 비었으니 입력한 닉네임 그대로 다시 저장
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" {...closeOnBackdrop(onClose)}>
      <div className="bg-white w-full max-w-lg h-full overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">회원 정보 편집</h3>
          <button type="button" onClick={onClose} className="text-gray-400 text-lg">
            ✕
          </button>
        </div>
        <p className="text-xs text-gray-500">
          {user.email} · 구글 이름 {user.name}
        </p>
        <div className="flex items-center gap-3">
          {f.image ? <img src={f.image} alt="" className="w-16 h-16 rounded-full object-cover border" /> : <div className="w-16 h-16 rounded-full bg-gray-100 border" />}
          <button type="button" onClick={() => fileRef.current?.click()} className="text-xs border rounded-lg px-3 py-1.5">
            프로필 사진 {f.image ? '바꾸기' : '올리기'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        </div>
        <label className="block">
          <span className="text-xs text-gray-500">닉네임 (기사 바이라인에 나오는 이름)</span>
          <input value={f.nickname} onChange={(e) => setF({ ...f, nickname: e.target.value })} className={input} maxLength={30} />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">자기소개 (기사 하단 기자 소개)</span>
          <textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} rows={4} className={input} />
        </label>
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500">원고료 정산 계좌 (편집장만 봄)</p>
          <div className="grid grid-cols-2 gap-2">
            <input value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} className={input} placeholder="은행" />
            <input value={f.accountHolder} onChange={(e) => setF({ ...f, accountHolder: e.target.value })} className={input} placeholder="예금주" />
          </div>
          <input value={f.bankAccount} onChange={(e) => setF({ ...f, bankAccount: e.target.value })} className={input} placeholder="계좌번호" />
        </div>
        {msg && <p className="text-xs text-red-600">{msg}</p>}
        {conflict && (
          <button type="button" disabled={busy} onClick={mergeLegacy} className="block text-xs font-semibold border border-brand text-brand rounded-lg px-3 py-1.5 disabled:opacity-40">
            같은 사람이면 합치기 — 옛 기사 {conflict.articleCount.toLocaleString()}건을 이 회원에게
          </button>
        )}
        <button type="button" disabled={busy} onClick={save} className="text-sm font-bold text-white bg-brand rounded-lg px-5 py-2 disabled:opacity-40">
          {busy ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );
}

export default function MembersAdminPage() {
  const searchParams = useSearchParams();
  // 관리자 대시보드 "기자관리"에서 ?role=REPORTER 로 진입 — 회원 관리 화면을 재사용해 필터만 적용 (2026-09-11 신설)
  const roleFilter = searchParams.get('role');
  const [me, setMe] = useState<any>('loading');
  const [users, setUsers] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);

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

  // 회원 삭제 — 확인창 한 번. 쓴 기사가 있으면 기사엔 이름만 남기고 영구 정리(lib/retireUser.ts, 2026-10-10)
  async function deleteUser(u: any) {
    if (!confirm(`${u.nickname || u.name} 회원을 영구히 삭제할까요?
쓴 기사가 있으면 기사에는 기자 이름만 그대로 남고, 로그인·목록에서는 사라집니다.`)) return;
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
                <td className="py-2 pr-4 text-gray-900 font-medium whitespace-nowrap">
                  {u.nickname || u.name}
                  {u.nickname && u.nickname !== u.name && <span className="ml-1 text-xs font-normal text-gray-400">({u.name})</span>}
                </td>
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
                    onClick={() => setEditing(u)}
                    className="ml-2 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 hover:border-brand"
                  >
                    편집
                  </button>
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
      {editing && <EditMember user={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </main>
  );
}
