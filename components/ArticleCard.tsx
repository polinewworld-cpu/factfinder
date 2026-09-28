'use client';

import { useState } from 'react';
import { timeAgo } from '@/lib/time';
import { ShareIcon, BookmarkIcon } from './icons';
import { useSavedArticles } from './SavedArticlesProvider';
import KineticTextGrid from './AppearText';
import { stripHtml } from '@/lib/stripHtml';

export type CardArticle = {
  id: string;
  title: string;
  content?: string | null; // 사진 없는 카드의 키네틱 배경 텍스트를 문장 단위로 뽑아내는 데 씀 (2026-09-17)
  excerpt?: string | null; // 본문 첫 문장 요약 — 사진이 없는 카드의 대체 문구로 노출 (2026-09-12 기능 구현)
  hoverText?: string | null; // 카드 이미지 마우스 오버 시 dimmed 배경 위에 흰색으로 표시되는 문구
  themeTags?: string | null; // 콤마 구분 문자열 — 마우스 오버 시 상단 중앙 핫핑크 배지로 노출 (2026-09-12 기능 구현)
  coverImageUrl?: string | null;
  publishedAt?: string | Date | null;
  author: { name: string };
  keywords: { name: string }[];
  category?: { name: string } | null;
};

const RATIOS = [0.72, 0.88, 1.04, 1.22, 1.38, 0.64, 0.96, 1.16];

// 사진을 업로드하지 않은 기사의 카드 배경색 — 매번 랜덤이 아니라 기사 id로 해시해 고정(새로고침해도 같은 색)
// (2026-09-12 신설: "어두운 랜덤한 컬러 + 핫핑크 타이포")
const FALLBACK_BG_COLORS = [
  '#1f1b2d', '#241522', '#182130', '#152318', '#2a1a12', '#211a2e', '#12242a', '#2a1420',
];

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// 본문을 문장 단위로 쪼개서 반환 — 키네틱 배경의 각 줄(row)에 서로 다른 문장을 배치하기 위함.
// (같은 문장이 여러 번 반복되면 "복사된 것처럼" 보인다는 피드백으로 2026-09-17 도입)
function splitSentences(text: string, poolSize: number): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  const parts = clean
    .split(/(?<=[.!?…]|다\.|요\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6)
    .map((s) => (s.length > 70 ? `${s.slice(0, 70)}…` : s));
  if (parts.length === 0) return [];
  return Array.from({ length: poolSize }, (_, i) => parts[i % parts.length]);
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
  const firstTheme = (article.themeTags ?? '').split(',').map((t) => t.trim()).filter(Boolean)[0];
  const fallbackBg = FALLBACK_BG_COLORS[hashString(`${article.id}-bg`) % FALLBACK_BG_COLORS.length];
  const fallbackRowCount = wide ? 7 : 11; // 와이드는 낮고 넓으니 줄 수를 줄임, 그 외엔 세로를 가득 채우도록 넉넉히
  const fallbackSentences = (() => {
    const pool = splitSentences(stripHtml(article.content || ''), fallbackRowCount);
    return pool.length > 0 ? pool : [article.title || article.excerpt || ''];
  })();
  const fallbackFontSize = featured ? 22 : wide ? 20 : 14;
  const href = `/article/${article.id}`;

  const { loggedIn, isChiefEditor, isSaved, setSaved } = useSavedArticles();
  const [saveBusy, setSaveBusy] = useState(false);
  const [hiddenFromMain, setHiddenFromMain] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const saved = isSaved(article.id);

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

  // 기사 저장(책갈피) 토글 — 로그인한 모든 회원 사용 가능 (기능정의서 3.1)
  async function toggleSave(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!loggedIn) {
      window.location.href = '/api/auth/signin';
      return;
    }
    setSaveBusy(true);
    try {
      const res = await fetch(`/api/articles/${article.id}/save`, { method: saved ? 'DELETE' : 'POST' });
      if (res.ok) setSaved(article.id, !saved);
    } finally {
      setSaveBusy(false);
    }
  }

  // 편집장 전용 — 메인(인덱스) 피드에서만 이 기사를 제외 (키워드/검색/저장 등 다른 화면엔 계속 노출). 카드 호버 시 좌하단 (-) 버튼 (2026-09-12 신설)
  async function removeFromMain(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm('이 기사를 메인 화면에서만 제외할까요? (키워드/검색 등에서는 계속 노출됩니다)')) return;
    setRemoveBusy(true);
    try {
      const res = await fetch(`/api/articles/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showOnMain: false }),
      });
      if (res.ok) setHiddenFromMain(true);
    } finally {
      setRemoveBusy(false);
    }
  }

  if (hiddenFromMain) return null;

  return (
    <article className={pinClass}>
      <a className="pin-media" href={href}>
        {article.coverImageUrl ? (
          <img src={article.coverImageUrl} alt="" style={{ aspectRatio: `1 / ${imageRatio}` }} />
        ) : (
          <div className="pin-fallback" style={{ aspectRatio: `1 / ${imageRatio}` }}>
            <KineticTextGrid
              texts={fallbackSentences}
              backgroundColor={fallbackBg}
              textColor="#ff2d8a"
              rowCount={fallbackRowCount}
              repeatCount={2}
              rowGap={6}
              wordGap={22}
              expandDurationSec={0.8}
              holdDurationSec={0.9}
              horizontalShiftPx={40}
              zoomScalePct={110}
              font={{
                fontFamily: 'var(--title)',
                fontWeight: 800,
                fontSize: fallbackFontSize,
                lineHeight: 1.3,
                letterSpacing: '-0.02em',
                textAlign: 'left',
              }}
            />
          </div>
        )}

        <div className="pin-overlay">
          {article.keywords[0] && (
            <button
              type="button"
              className="pin-keyword-badge"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                window.location.href = `/keyword/${encodeURIComponent(article.keywords[0].name)}`;
              }}
            >
              #{article.keywords[0].name}
            </button>
          )}
          {firstTheme && <span className="pin-theme-badge">{firstTheme}</span>}
          {article.hoverText && <p className="pin-hover-text">{article.hoverText}</p>}
          {isChiefEditor && (
            <button
              type="button"
              className="pin-remove-main-btn"
              onClick={removeFromMain}
              disabled={removeBusy}
              aria-label="메인에서 제외"
              title="메인에서 제외"
            >
              −
            </button>
          )}
          <span className="overlay-actions">
            <button
              type="button"
              className={`save-button${saved ? ' is-saved' : ''}`}
              onClick={toggleSave}
              disabled={saveBusy}
              aria-pressed={saved}
              aria-label={saved ? '저장 취소' : '기사 저장'}
            >
              <BookmarkIcon filled={saved} />
            </button>
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
        <div className="pin-meta">
          <span>{article.author.name}</span>
          <span className="dot" />
          <time>{article.publishedAt ? timeAgo(article.publishedAt) : ''}</time>
        </div>
      </div>
    </article>
  );
}
