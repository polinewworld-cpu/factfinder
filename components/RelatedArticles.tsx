'use client';

import { useEffect, useState } from 'react';
import { timeAgo } from '@/lib/time';

type Item = { id: string; title: string; author: { name: string }; publishedAt: string };

export default function RelatedArticles({ articleId, keywordNames }: { articleId: string; keywordNames: string[] }) {
  const [mode, setMode] = useState<'related' | 'latest' | 'popular'>('latest');
  const [items, setItems] = useState<Item[]>([]);
  const [hasRelated, setHasRelated] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 초기 진입 시: 같은 키워드 기사가 있으면 "관련기사"로, 없으면 "최신기사"로 시작
  useEffect(() => {
    (async () => {
      if (keywordNames.length > 0) {
        const res = await fetch(`/api/articles?keyword=${encodeURIComponent(keywordNames[0])}&exclude=${articleId}&pageSize=5`);
        const data = await res.json();
        if (data.length > 0) {
          setItems(data);
          setHasRelated(true);
          setMode('related');
          setLoaded(true);
          return;
        }
      }
      const res = await fetch(`/api/articles?exclude=${articleId}&pageSize=5`);
      setItems(await res.json());
      setLoaded(true);
    })();
  }, [articleId, keywordNames.join(',')]);

  async function switchMode(next: 'latest' | 'popular') {
    setMode(next);
    const res = await fetch(`/api/articles?exclude=${articleId}&pageSize=5${next === 'popular' ? '&sort=popular' : ''}`);
    setItems(await res.json());
  }

  return (
    <aside className="lg:w-80 shrink-0">
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        {mode === 'related' ? (
          <h4 className="font-bold text-sm mb-3 text-gray-900">관련기사</h4>
        ) : (
          <div className="flex gap-3 text-sm font-bold mb-3">
            <button
              onClick={() => switchMode('latest')}
              className={mode === 'latest' ? 'text-brand' : 'text-gray-400'}
            >
              최신기사
            </button>
            <button
              onClick={() => switchMode('popular')}
              className={mode === 'popular' ? 'text-brand' : 'text-gray-400'}
            >
              많이 본 기사
            </button>
          </div>
        )}
        {!loaded && <p className="text-gray-400 text-xs">불러오는 중…</p>}
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id}>
              <a href={`/article/${a.id}`} className="block text-gray-900 hover:text-brand">
                <p className="text-sm font-semibold leading-snug line-clamp-2">{a.title}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {a.author.name} · {timeAgo(a.publishedAt)}
                </p>
              </a>
            </li>
          ))}
          {loaded && items.length === 0 && <p className="text-gray-400 text-xs">표시할 기사가 없습니다.</p>}
        </ul>
      </div>
    </aside>
  );
}
