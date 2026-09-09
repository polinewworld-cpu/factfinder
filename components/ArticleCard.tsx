'use client';

import { timeAgo } from '@/lib/time';
import { ShareIcon } from './icons';

export type CardArticle = {
  id: string;
  title: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  publishedAt?: string | Date | null;
  author: { name: string };
  keywords: { name: string }[];
  category?: { name: string } | null;
  isFrontpageTop?: boolean;
};

const RATIOS = [0.72, 0.88, 1.04, 1.22, 1.38, 0.64, 0.96, 1.16];

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export default function ArticleCard({
  article,
  featured = false,
  wide = false,
}: {
  article: CardArticle;
  featured?: boolean;
  wide?: boolean;
}) {
  const ratio = RATIOS[hashString(article.id) % RATIOS.length];
  const imageRatio = featured ? 1.12 : wide ? 0.46 : ratio;
  const pinClass = featured ? 'pin is-featured' : wide ? 'pin is-wide' : 'pin';
  const badges = article.keywords.map((k) => k.name).slice(0, 2);
  const href = `/article/${article.id}`;
  const categoryLabel = article.category?.name ?? '정치';

  async function shareArticle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const url = `${window.location.origin}${href}`;
    const payload = { title: article.title, url };
    if (navigator.share) {
      try {
        await navigator.share(payload);
      } catch {
        /* user cancelled */
      }
      return;
    }
    await navigator.clipboard.writeText(url);
  }

  return (
    <article className={pinClass}>
      <a className="pin-media" href={href}>
        {article.coverImageUrl ? (
          <img src={article.coverImageUrl} alt="" style={{ aspectRatio: `1 / ${imageRatio}` }} />
        ) : (
          <div className="pin-fallback" style={{ aspectRatio: `1 / ${imageRatio}` }}>
            <p>{(article.excerpt || article.title || '').slice(0, 90)}</p>
          </div>
        )}

        <div className="pin-overlay">
          <span className="read-pill">읽기</span>
          <span className="overlay-actions">
            <span className="ghost-chip">{badges[0] || categoryLabel}</span>
            <button type="button" className="share-button" onClick={shareArticle} aria-label="공유">
              <ShareIcon />
            </button>
          </span>
        </div>
      </a>

      <div className="pin-copy">
        {badges.length > 0 && (
          <div className="badge-row">
            {badges.map((badge) => (
              <span key={badge} className="badge">
                {badge}
              </span>
            ))}
          </div>
        )}
        <h2>
          <a href={href}>{article.title}</a>
        </h2>
        {(featured || wide) && article.excerpt && <p className="pin-excerpt">{article.excerpt}</p>}
        <div className="pin-meta">
          <span>{article.author.name}</span>
          <span className="dot" />
          <time>{article.publishedAt ? timeAgo(article.publishedAt) : ''}</time>
        </div>
      </div>
    </article>
  );
}
