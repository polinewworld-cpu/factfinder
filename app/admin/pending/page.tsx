'use client';

import { useEffect, useState } from 'react';
import { timeAgo } from '@/lib/time';

type PendingArticle = {
  id: string;
  title: string;
  author: { name: string };
  category?: { name: string } | null;
  updatedAt: string;
};

export default function PendingQueuePage() {
  const [me, setMe] = useState<any>('loading');
  const [items, setItems] = useState<PendingArticle[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/articles?status=draft');
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/me');
      const meData = meRes.ok ? await meRes.json() : null;
      setMe(meData);
      if (meData?.role === 'CHIEF_EDITOR') await load();
    })();
  }, []);

  async function act(id: string, action: 'approve' | 'reject') {
    setBusyId(id);
    await fetch(`/api/articles/${id}/${action}`, { method: 'POST' });
    setItems((prev) => prev.filter((a) => a.id !== id));
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

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">승인 대기함 ({items.length})</h1>
      {items.length === 0 && <p className="text-gray-400 text-sm">승인 대기 중인 기사가 없습니다.</p>}
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id} className="flex items-center justify-between border border-gray-200 rounded-xl p-4">
            <div>
              <p className="text-xs text-brand font-bold mb-1">{a.category?.name ?? '카테고리 미지정'}</p>
              <p className="font-semibold text-gray-900">{a.title || '(제목 없음)'}</p>
              <p className="text-xs text-gray-400 mt-1">
                {a.author.name} · {timeAgo(a.updatedAt)}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                disabled={busyId === a.id}
                onClick={() => act(a.id, 'reject')}
                className="text-sm text-gray-500 border border-gray-200 rounded-full px-4 py-1.5 hover:border-gray-400"
              >
                반려
              </button>
              <button
                disabled={busyId === a.id}
                onClick={() => act(a.id, 'approve')}
                className="text-sm font-bold text-white bg-brand rounded-full px-4 py-1.5 hover:bg-brand-dark"
              >
                승인
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
