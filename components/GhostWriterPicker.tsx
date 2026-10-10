'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { UserAvatar } from './InitialAvatar';
import { closeOnBackdrop } from '@/lib/backdrop';

// 글쓰기 화면 글쓴이 → [비회원 기자] 고르기 레이어(10-10 종류 재정의 — 비회원 기자만 나옴) (2026-10-10 사장님: 드롭박스가 불편 — 이름과 프로필 사진이 함께 뜨게)
// 이름·직함·메모로 찾기, 사진 카드로 고르기, 새 비회원 기자도 여기서 바로 등록. 같은 이름 허용.
export type GhostWriterOption = {
  id: string;
  displayName: string;
  writerTitle: string | null;
  writerMemo?: string | null;
  image?: string | null;
  articleCount?: number;
};

export default function GhostWriterPicker({
  writers,
  selectedId,
  onPick,
  onCreated,
  onClose,
}: {
  writers: GhostWriterOption[];
  selectedId: string;
  onPick: (id: string) => void;
  onCreated: (w: GhostWriterOption) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', writerTitle: '', writerMemo: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // 처음 열 때 한 번만 찾기 칸에 커서 — 부모가 다시 그려질 때(자동저장 등)마다 커서를 뺏지 않도록 빈 의존성
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const shown = useMemo(() => {
    const t = q.trim();
    const list = t ? writers.filter((w) => `${w.displayName} ${w.writerTitle ?? ''} ${w.writerMemo ?? ''}`.includes(t)) : writers;
    return [...list].sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'));
  }, [writers, q]);

  function pick(id: string) {
    onPick(id);
    onClose();
  }

  async function create() {
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/ghost-writers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(d.error ?? '등록 실패');
    onCreated({ id: d.id, displayName: d.displayName, writerTitle: d.writerTitle, writerMemo: d.writerMemo, image: d.image, articleCount: 0 });
    pick(d.id);
  }

  const field = 'border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand bg-white';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" {...closeOnBackdrop(onClose)}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" role="dialog" aria-label="비회원 기자 고르기">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <h3 className="font-bold text-gray-900 shrink-0">비회원 기자 고르기</h3>
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && shown.length === 1) pick(shown[0].id);
            }}
            className={`${field} flex-1`}
            placeholder="이름·직함·메모로 찾기"
          />
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none" aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
          {shown.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => pick(w.id)}
              className={`flex items-center gap-3 text-left rounded-xl border p-2.5 hover:border-brand hover:bg-gray-50 ${
                w.id === selectedId ? 'border-brand ring-1 ring-brand' : 'border-gray-200'
              }`}
            >
              <UserAvatar image={w.image} seed={w.id} name={w.displayName} className="w-11 h-11 rounded-full object-cover shrink-0 text-base" />
              <span className="min-w-0">
                <b className="block text-sm text-gray-900 truncate">{w.displayName}</b>
                {w.writerTitle && <span className="block text-xs text-gray-600 truncate">{w.writerTitle}</span>}
                {w.writerMemo && <span className="block text-[11px] text-gray-400 truncate">{w.writerMemo}</span>}
                {typeof w.articleCount === 'number' && <span className="block text-[11px] text-gray-400">기사 {w.articleCount.toLocaleString()}건</span>}
              </span>
            </button>
          ))}
          {!shown.length && <p className="col-span-full text-sm text-gray-400 py-6 text-center">찾는 비회원 기자가 없습니다. 아래에서 새로 등록하세요.</p>}
        </div>

        <div className="p-4 border-t border-gray-100">
          {!adding ? (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setForm((f) => ({ ...f, name: f.name || q.trim() }));
              }}
              className="text-sm font-semibold text-brand"
            >
              + 새 비회원 기자 등록
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${field} w-32`} placeholder="이름" maxLength={30} />
              <input value={form.writerTitle} onChange={(e) => setForm({ ...form, writerTitle: e.target.value })} className={`${field} w-44`} placeholder="직함 (선택)" maxLength={40} />
              <input value={form.writerMemo} onChange={(e) => setForm({ ...form, writerMemo: e.target.value })} className={`${field} w-44`} placeholder="메모 20자 (선택)" maxLength={20} />
              <button type="button" disabled={busy || !form.name.trim()} onClick={create} className="text-sm font-bold text-white bg-brand rounded-lg px-3 py-1.5 disabled:opacity-40">
                등록하고 고르기
              </button>
              <button type="button" onClick={() => setAdding(false)} className="text-sm text-gray-500 px-1">
                취소
              </button>
            </div>
          )}
          {msg && <p className="text-xs text-red-600 mt-2">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
