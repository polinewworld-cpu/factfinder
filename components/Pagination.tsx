// 목록 하단 페이지 번호 — 옛 기사 3천여 건 이관에 맞춰 신설 (2026-10-08)
// 서버 컴포넌트(일반 링크)라 검색엔진도 2페이지 이후 옛 기사까지 따라 들어갈 수 있다.
export default function Pagination({
  page,
  totalPages,
  category,
}: {
  page: number;
  totalPages: number;
  category?: string;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  };

  // 현재 페이지 앞뒤 2개 + 처음·끝, 사이가 비면 "…"
  const pages: (number | '…')[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 2) pages.push(p);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }

  return (
    <nav className="content pagination" aria-label="페이지">
      {page > 1 ? (
        <a className="pagination-step" href={href(page - 1)} rel="prev">‹ 이전</a>
      ) : (
        <span className="pagination-step is-disabled">‹ 이전</span>
      )}
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="pagination-gap">…</span>
        ) : (
          <a
            key={p}
            href={href(p)}
            className={`pagination-num${p === page ? ' is-active' : ''}`}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </a>
        )
      )}
      {page < totalPages ? (
        <a className="pagination-step" href={href(page + 1)} rel="next">다음 ›</a>
      ) : (
        <span className="pagination-step is-disabled">다음 ›</span>
      )}
    </nav>
  );
}
