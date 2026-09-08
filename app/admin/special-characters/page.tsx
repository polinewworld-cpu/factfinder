'use client';

import { useEffect, useState } from 'react';

export default function SpecialCharactersAdminPage() {
  const [me, setMe] = useState<any>('loading');
  const [chars, setChars] = useState<{ id: string; char: string; label?: string | null }[]>([]);
  const [newChar, setNewChar] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function load() {
    const res = await fetch('/api/special-characters');
    if (res.ok) setChars(await res.json());
  }

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/me');
      const meData = meRes.ok ? await meRes.json() : null;
      setMe(meData);
      await load();
    })();
  }, []);

  async function add() {
    if (!newChar.trim()) return;
    setErrorMsg('');
    const res = await fetch('/api/special-characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ char: newChar.trim(), label: newLabel.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok) return setErrorMsg(data.error ?? '추가 실패');
    setNewChar('');
    setNewLabel('');
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/special-characters/${id}`, { method: 'DELETE' });
    await load();
  }

  if (me === 'loading') return <main className="max-w-2xl mx-auto px-4 py-10 text-gray-500">불러오는 중…</main>;
  if (!me || me.role !== 'CHIEF_EDITOR') {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <p className="text-gray-600">편집장만 접근할 수 있습니다.</p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">특수문자 관리</h1>
      <p className="text-xs text-gray-400 mb-4">여기서 추가/삭제한 항목이 기자용 글쓰기 화면 에디터 툴바에 그대로 반영됩니다.</p>
      {errorMsg && <p className="text-red-600 text-sm mb-3">{errorMsg}</p>}

      <div className="flex gap-2 mb-6">
        <input
          value={newChar}
          onChange={(e) => setNewChar(e.target.value)}
          placeholder="문자 (예: ▶)"
          className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="설명 (선택, 관리용)"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={add} className="text-sm font-bold text-white bg-brand rounded-lg px-4 py-2">
          추가
        </button>
      </div>

      <ul className="space-y-2">
        {chars.map((c) => (
          <li key={c.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-2">
            <span className="text-lg text-gray-800 w-10">{c.char}</span>
            <span className="text-sm text-gray-400 flex-1">{c.label}</span>
            <button onClick={() => remove(c.id)} className="text-gray-400 hover:text-red-500 text-xs">
              삭제
            </button>
          </li>
        ))}
      </ul>
      {chars.length === 0 && <p className="text-gray-400 text-sm">등록된 특수문자가 없습니다.</p>}
    </main>
  );
}
