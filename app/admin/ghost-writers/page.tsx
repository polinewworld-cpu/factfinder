'use client';

import { useEffect, useRef, useState } from 'react';
import AdminTabs, { PEOPLE_TABS } from '@/components/AdminTabs';
import { compressImageFile } from '@/lib/imageCompress';

// 회원/기자관리 → 유령기자 (2026-10-09 사장님 정의) — 로그인 없이 이름으로만 존재하는 필자(외부 기고자·옛 사이트 기자).
// 이름·직함·프로필 사진(바이라인), 원고료 정산용 계좌, 주민등록증 사진(암호화 저장, 편집장만 열람).
type Row = { id: string; displayName: string; writerTitle: string | null; image: string | null; articleCount: number; idImageCount: number; hasBank: boolean };
type Detail = {
  id: string;
  displayName: string;
  writerTitle: string | null;
  image: string | null;
  bankName: string | null;
  bankAccount: string | null;
  accountHolder: string | null;
  articleCount: number;
  idImages: { id: string; createdAt: string }[];
};

const input = 'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-brand bg-white';

function EditPanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [form, setForm] = useState({ name: '', writerTitle: '', image: '', bankName: '', bankAccount: '', accountHolder: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch(`/api/ghost-writers/${id}`);
    if (!res.ok) return setMsg('불러오지 못했습니다');
    const data: Detail = await res.json();
    setD(data);
    setForm({
      name: data.displayName,
      writerTitle: data.writerTitle ?? '',
      image: data.image ?? '',
      bankName: data.bankName ?? '',
      bankAccount: data.bankAccount ?? '',
      accountHolder: data.accountHolder ?? '',
    });
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save() {
    setBusy(true);
    setMsg('');
    const res = await fetch(`/api/ghost-writers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setBusy(false);
    if (!res.ok) return setMsg((await res.json().catch(() => ({}))).error ?? '저장 실패');
    setMsg('저장했습니다.');
    onChanged();
  }

  async function uploadPhoto(f?: File) {
    if (!f) return;
    const fd = new FormData();
    fd.append('file', await compressImageFile(f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data.error ?? '사진 업로드 실패');
    setForm((x) => ({ ...x, image: data.url }));
    setMsg('프로필 사진을 바꿨습니다. [저장]을 누르세요.');
  }

  async function uploadId(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMsg('');
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch(`/api/ghost-writers/${id}/id-images`, { method: 'POST', body: fd });
      if (!res.ok) {
        setMsg((await res.json().catch(() => ({}))).error ?? '올리기 실패');
        break;
      }
    }
    setBusy(false);
    if (idRef.current) idRef.current.value = '';
    await load();
    onChanged();
  }

  async function removeId(imageId: string) {
    if (!confirm('이 신분증 사진을 지울까요? 되돌릴 수 없습니다.')) return;
    await fetch(`/api/ghost-writers/${id}/id-images/${imageId}`, { method: 'DELETE' });
    await load();
    onChanged();
  }

  async function hide() {
    if (!confirm(`"${d?.displayName}"을(를) 유령기자 목록에서 지울까요? 쓴 기사와 이름은 그대로 남습니다.`)) return;
    await fetch(`/api/ghost-writers/${id}`, { method: 'DELETE' });
    onChanged();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose}>
      <div className="bg-white w-full max-w-lg h-full overflow-y-auto p-5 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">유령기자 정보</h3>
          <button type="button" onClick={onClose} className="text-gray-400 text-lg">
            ✕
          </button>
        </div>
        {!d ? (
          <p className="text-sm text-gray-400">{msg || '불러오는 중…'}</p>
        ) : (
          <>
            <section className="space-y-3">
              <p className="text-xs font-semibold text-gray-500">기사 바이라인에 나오는 정보 · 쓴 기사 {d.articleCount}건</p>
              <div className="flex items-center gap-3">
                {form.image ? (
                  <img src={form.image} alt="" className="w-16 h-16 rounded-full object-cover border" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-100 border" />
                )}
                <button type="button" onClick={() => photoRef.current?.click()} className="text-xs border rounded-lg px-3 py-1.5">
                  프로필 사진 {form.image ? '바꾸기' : '올리기'}
                </button>
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
              </div>
              <label className="block">
                <span className="text-xs text-gray-500">이름</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} maxLength={30} />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">직함 (바이라인: &quot;이름 직함&quot; — 비우면 &quot;이름 기자&quot;)</span>
                <input value={form.writerTitle} onChange={(e) => setForm({ ...form, writerTitle: e.target.value })} className={input} placeholder="예) 前 ○○대 교수, 칼럼니스트" maxLength={40} />
              </label>
            </section>

            <section className="space-y-3 border-t pt-4">
              <p className="text-xs font-semibold text-gray-500">원고료 정산 (편집장만 볼 수 있음)</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs text-gray-500">은행</span>
                  <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className={input} />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">예금주</span>
                  <input value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })} className={input} />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-gray-500">계좌번호</span>
                <input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} className={input} />
              </label>
            </section>

            <div className="flex items-center gap-3">
              <button type="button" disabled={busy} onClick={save} className="text-sm font-bold text-white bg-brand rounded-lg px-5 py-2 disabled:opacity-40">
                저장
              </button>
              {msg && <span className="text-xs text-gray-600">{msg}</span>}
            </div>

            <section className="space-y-2 border-t pt-4">
              <p className="text-xs font-semibold text-gray-500">주민등록증 사진 (암호화 저장 · 편집장만 열람)</p>
              <button type="button" disabled={busy} onClick={() => idRef.current?.click()} className="text-xs border rounded-lg px-3 py-1.5 disabled:opacity-40">
                {busy ? '올리는 중…' : '사진 올리기'}
              </button>
              <input ref={idRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => uploadId(e.target.files)} />
              {d.idImages.length ? (
                <ul className="text-sm space-y-1">
                  {d.idImages.map((im, i) => (
                    <li key={im.id} className="flex items-center gap-3">
                      <span className="text-gray-600">
                        {i + 1}. {new Date(im.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} 올림
                      </span>
                      <a href={`/api/ghost-writers/${id}/id-images/${im.id}`} target="_blank" rel="noopener noreferrer" className="text-xs underline">
                        보기
                      </a>
                      <button type="button" onClick={() => removeId(im.id)} className="text-xs text-red-600">
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-400">올린 사진이 없습니다.</p>
              )}
            </section>

            <div className="border-t pt-4">
              <button type="button" onClick={hide} className="text-xs border border-red-200 text-red-600 rounded-lg px-3 py-1.5">
                유령기자 목록에서 삭제
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function GhostWritersPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [newForm, setNewForm] = useState({ name: '', writerTitle: '' });
  const [msg, setMsg] = useState('');

  async function load() {
    const res = await fetch('/api/ghost-writers');
    setRows(res.ok ? await res.json() : []);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    setMsg('');
    const res = await fetch('/api/ghost-writers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newForm) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(d.error ?? '등록 실패');
    setNewForm({ name: '', writerTitle: '' });
    await load();
    setEditId(d.id);
  }

  const shown = (rows ?? []).filter((r) => !q.trim() || `${r.displayName} ${r.writerTitle ?? ''}`.includes(q.trim()));

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <AdminTabs title="회원/기자관리" tabs={PEOPLE_TABS} />
      <p className="text-sm text-gray-500 mb-4">
        로그인 계정 없이 이름으로만 있는 필자입니다(외부 기고자·옛 사이트 기자). 글쓰기 화면 글쓴이에서 <b>[유령기자]</b>를 고르면 그 사람 이름·직함으로 나가고 원고료·후원 정산도 그 사람 앞으로 기록됩니다.
      </p>

      <div className="border rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">새 유령기자</span>
        <input value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} className="border rounded-lg px-2 py-1 text-sm w-36" placeholder="이름" maxLength={30} />
        <input value={newForm.writerTitle} onChange={(e) => setNewForm({ ...newForm, writerTitle: e.target.value })} className="border rounded-lg px-2 py-1 text-sm w-56" placeholder="직함 (선택)" maxLength={40} />
        <button type="button" onClick={create} disabled={!newForm.name.trim()} className="text-xs font-bold text-white bg-brand rounded-lg px-3 py-1.5 disabled:opacity-40">
          등록
        </button>
        {msg && <span className="text-xs text-red-600">{msg}</span>}
        <input value={q} onChange={(e) => setQ(e.target.value)} className="ml-auto border rounded-lg px-2 py-1 text-sm w-40" placeholder="이름 찾기" />
      </div>

      {!rows ? (
        <p className="text-sm text-gray-400">불러오는 중…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2 pr-3">이름</th>
                <th className="py-2 pr-3">직함</th>
                <th className="py-2 pr-3 text-right">기사</th>
                <th className="py-2 pr-3">계좌</th>
                <th className="py-2 pr-3">신분증</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-2">
                      {r.image ? <img src={r.image} alt="" className="w-7 h-7 rounded-full object-cover" /> : <span className="w-7 h-7 rounded-full bg-gray-100 inline-block" />}
                      <b>{r.displayName}</b>
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-gray-600">{r.writerTitle ?? '-'}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.articleCount.toLocaleString()}</td>
                  <td className="py-2 pr-3">{r.hasBank ? '등록' : <span className="text-gray-400">없음</span>}</td>
                  <td className="py-2 pr-3">{r.idImageCount ? `${r.idImageCount}장` : <span className="text-gray-400">없음</span>}</td>
                  <td className="py-2 text-right">
                    <button type="button" onClick={() => setEditId(r.id)} className="text-xs border rounded-lg px-3 py-1">
                      관리
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <p className="text-sm text-gray-400 py-4">해당하는 유령기자가 없습니다.</p>}
        </div>
      )}

      {editId && <EditPanel id={editId} onClose={() => setEditId(null)} onChanged={load} />}
    </main>
  );
}
