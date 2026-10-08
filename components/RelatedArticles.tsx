'use client';

import { useEffect, useState } from 'react';
import { timeAgo } from '@/lib/time';
import { cardImageRatio } from '@/lib/cardImage';
import { toFrenchBrackets } from '@/lib/frenchBrackets';
import { withoutTitleBreaks } from '@/lib/titleLineBreak';
import { RightPanelIcon } from '@/components/icons';
import CoverHoverImage from './CoverHoverImage';

const RAIL_STORAGE_KEY = 'factfinder-article-rail';

type Item = {
  id: string;
  title: string;
  author: { name: string; nickname?: string | null };
  publishedAt: string;
  coverImageUrl?: string | null;
  coverFocalX?: number | null;
  coverFocalY?: number | null;
};

function RailCard({ article }: { article: Item }) {
  const href = `/article/${article.id}`;
  const imageRatio = cardImageRatio(article.id);
  const title = toFrenchBrackets(withoutTitleBreaks(article.title));
  return (
    <article className="pin rail-pin">
      <a className="pin-media" href={href}>
        {article.coverImageUrl ? (
          <CoverHoverImage
            src={article.coverImageUrl}
            alt={title}
            aspectRatio={`1 / ${imageRatio}`}
            focalX={article.coverFocalX}
            focalY={article.coverFocalY}
          />
        ) : (
          <div className="pin-fallback" style={{ aspectRatio: `1 / ${imageRatio}` }}>
            <p>{title}</p>
          </div>
        )}
      </a>
      <div className="pin-copy">
        <h2>
          <a href={href}>{title}</a>
        </h2>
        <div className="pin-meta">
          <span>{article.author.nickname || article.author.name}</span>
          <span className="dot" />
          <time>{timeAgo(article.publishedAt)}</time>
        </div>
      </div>
    </article>
  );
}

export default function RelatedArticles({
  articleId,
  keywordNames,
  manualRelated = [],
}: {
  articleId: string;
  keywordNames: string[];
  manualRelated?: Item[];
}) {
  const [mode, setMode] = useState<'related' | 'latest' | 'popular'>(manualRelated.length > 0 ? 'related' : 'latest');
  const [items, setItems] = useState<Item[]>(manualRelated);
  const [loaded, setLoaded] = useState(manualRelated.length > 0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(RAIL_STORAGE_KEY) === '0') setOpen(false);
  }, []);

  function toggleRail() {
    setOpen((prev) => {
      const next = !prev;
      localStorage.setItem(RAIL_STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }

  // 작성자가 직접 고른 관련기사가 있으면 그걸 우선 노출 (기능정의서 8.2) — 없을 때만 기존 키워드/최신 로직 사용
  useEffect(() => {
    if (manualRelated.length > 0) return;
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
    <aside className={`article-rail${open ? '' : ' is-collapsed'}`} aria-label="다른 기사">
      <div className="article-rail-head">
        {open && mode !== 'related' && (
          <div className="article-rail-tabs">
            <button
              type="button"
              onClick={() => switchMode('latest')}
              className={mode === 'latest' ? 'is-on' : undefined}
            >
              최신기사
            </button>
            <button
              type="button"
              onClick={() => switchMode('popular')}
              className={mode === 'popular' ? 'is-on' : undefined}
            >
              많이 본 기사
            </button>
          </div>
        )}
        {open && mode === 'related' && (
          <p className="article-rail-tabs-label">관련기사</p>
        )}
        <button
          type="button"
          className="article-rail-toggle"
          aria-label={open ? '사이드 칼럼 숨기기' : '사이드 칼럼 보이기'}
          aria-pressed={open}
          title={open ? '칼럼 숨기기' : '칼럼 보이기'}
          onClick={toggleRail}
        >
          <RightPanelIcon />
        </button>
      </div>
      {open && (
        <>
          {!loaded && <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ash)' }}>불러오는 중…</p>}
          <div className="rail-list">
            {items.map((a) => (
              <RailCard key={a.id} article={a} />
            ))}
            {loaded && items.length === 0 && (
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ash)' }}>표시할 기사가 없습니다.</p>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
