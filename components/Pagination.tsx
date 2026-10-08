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

  // 10개 단위 묶음 (1~10, 11~20 …) — 이전/다음은 앞뒤 묶음의 첫·끝 페이지로 (2026-10-08 사장님 지시)
  const BLOCK = 10;
  const blockStart = Math.floor((page - 1) / BLOCK) * BLOCK + 1;
  const blockEnd = Math.min(totalPages, blockStart + BLOCK - 1);
  const pages: number[] = [];
  for (let p = blockStart; p <= blockEnd; p++) pages.push(p);
  const prevPage = blockStart > 1 ? blockStart - 1 : null;
  const nextPage = blockEnd < totalPages ? blockEnd + 1 : null;

  return (
    <nav className="content pagination" aria-label="페이지">
      {prevPage ? (
        <a className="pagination-step" href={href(prevPage)} rel="prev">‹ 이전</a>
      ) : (
        <span className="pagination-step is-disabled">‹ 이전</span>
      )}
      {pages.map((p) => (
        <a
          key={p}
          href={href(p)}
          className={`pagination-num${p === page ? ' is-active' : ''}`}
          aria-current={p === page ? 'page' : undefined}
        >
          {p}
        </a>
      ))}
      {nextPage ? (
        <a className="pagination-step" href={href(nextPage)} rel="next">다음 ›</a>
      ) : (
        <span className="pagination-step is-disabled">다음 ›</span>
      )}
    </nav>
  );
}
