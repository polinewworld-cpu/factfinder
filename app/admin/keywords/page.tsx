'use client';

import { useEffect, useState } from 'react';

export default function KeywordsAdminPage() {
  const [me, setMe] = useState<any>('loading');
  const [keywords, setKeywords] = useState<{ id: string; name: string }[]>([]);
  const [newName, setNewName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function load() {
    const res = await fetch('/api/keywords');
    if (res.ok) setKeywords(await res.json());
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
    if (!newName.trim()) return;
    setErrorMsg('');
    const res = await fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    if (!res.ok) return setErrorMsg(data.error ?? '추가 실패');
    setNewName('');
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/keywords/${id}`, { method: 'DELETE' });
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
      <h1 className="text-xl font-bold text-gray-900 mb-6">키워드 관리</h1>
      {errorMsg && <p className="text-red-600 text-sm mb-3">{errorMsg}</p>}

      <div className="flex gap-2 mb-6">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="새 키워드 (예: 단독, 여론)"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={add} className="text-sm font-bold text-white bg-brand rounded-lg px-4 py-2">
          추가
        </button>
      </div>

      <ul className="flex flex-wrap gap-2">
        {keywords.map((k) => (
          <li key={k.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full pl-3 pr-1 py-1">
            <span className="text-sm text-gray-800">{k.name}</span>
            <button
              onClick={() => remove(k.id)}
              className="text-gray-400 hover:text-red-500 w-5 h-5 rounded-full text-xs"
              title="삭제"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {keywords.length === 0 && <p className="text-gray-400 text-sm">등록된 키워드가 없습니다.</p>}
    </main>
  );
}
