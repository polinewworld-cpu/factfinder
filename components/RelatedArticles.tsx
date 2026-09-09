'use client';

import { useEffect, useState } from 'react';
import { timeAgo } from '@/lib/time';

type Item = {
  id: string;
  title: string;
  author: { name: string };
  publishedAt: string;
  coverImageUrl?: string | null;
};

function RailCard({ article }: { article: Item }) {
  const href = `/article/${article.id}`;
  return (
    <article className="pin rail-pin">
      <a className="pin-media" href={href}>
        {article.coverImageUrl ? (
          <img src={article.coverImageUrl} alt="" style={{ aspectRatio: '1 / 0.72' }} />
        ) : (
          <div className="pin-fallback" style={{ aspectRatio: '1 / 0.72' }}>
            <p>{article.title}</p>
          </div>
        )}
      </a>
      <div className="pin-copy">
        <h2>
          <a href={href}>{article.title}</a>
        </h2>
        <div className="pin-meta">
          <span>{article.author.name}</span>
          <span className="dot" />
          <time>{timeAgo(article.publishedAt)}</time>
        </div>
      </div>
    </article>
  );
}

export default function RelatedArticles({ articleId, keywordNames }: { articleId: string; keywordNames: string[] }) {
  const [mode, setMode] = useState<'related' | 'latest' | 'popular'>('latest');
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 초기 진입 시: 같은 키워드 기사가 있으면 "관련기사"로, 없으면 "최신기사"로 시작
  useEffect(() => {
    (async () => {
      if (keywordNames.length > 0) {
        const res = await fetch(`/api/articles?keyword=${encodeURIComponent(keywordNames[0])}&exclude=${articleId}&pageSize=5`);
        const data = await res.json();
        if (data.length > 0) {
          setItems(data);
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
    <aside className="article-rail" aria-label="다른 기사">
      {mode !== 'related' && (
        <div style={{ display: 'flex', gap: 12, fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
          <button
            onClick={() => switchMode('latest')}
            style={{ color: mode === 'latest' ? 'var(--accent)' : 'var(--ash)' }}
          >
            최신기사
          </button>
          <button
            onClick={() => switchMode('popular')}
            style={{ color: mode === 'popular' ? 'var(--accent)' : 'var(--ash)' }}
          >
            많이 본 기사
          </button>
        </div>
      )}
      {mode === 'related' && (
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--mute)', margin: '0 0 16px' }}>관련기사</p>
      )}
      {!loaded && <p style={{ fontSize: 12, color: 'var(--ash)' }}>불러오는 중…</p>}
      <div className="rail-list">
        {items.map((a) => (
          <RailCard key={a.id} article={a} />
        ))}
        {loaded && items.length === 0 && <p style={{ fontSize: 12, color: 'var(--ash)' }}>표시할 기사가 없습니다.</p>}
      </div>
    </aside>
  );
}
