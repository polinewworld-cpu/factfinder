'use client';

import { useEffect, useMemo, useState } from 'react';

type ArticleRow = { id: string; title: string; updatedAt: string; author: { name: string } };

const PAGE_SIZE = 10;
const PAGE_WINDOW = 10; // 한 화면에 보여줄 페이지 번호 개수

// 관련기사 선택 모달 — 별도 레이어에서 검색 + 체크박스 다중선택 + 페이지네이션 (기능정의서 8.2, UX 개선 2026-09-11)
// 첨부된 "등록기사 리스트" 목업(검색창 + 체크박스 목록(기사제목/최종편집일) + 페이지네이션 + "선택기사 추가")을 그대로 따름.
export default function RelatedArticlePickerModal({
  open,
  onClose,
  onSelect,
  excludeIds = [],
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (articles: { id: string; title: string; author: { name: string }; updatedAt: string }[]) => void;
  excludeIds?: string[];
}) {
  const [query, setQuery] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [page, setPage] = useState(1);
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checkedMap, setCheckedMap] = useState<Record<string, ArticleRow>>({});

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setQueryInput('');
    setPage(1);
    setCheckedMap({});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    if (excludeIds.length) params.set('excludeIds', excludeIds.join(','));
    fetch(`/api/articles/browse?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { articles: [], total: 0 }))
      .then((data) => {
        setArticles(data.articles ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const windowStart = Math.floor((page - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1;
  const windowEnd = Math.min(totalPages, windowStart + PAGE_WINDOW - 1);
  const pageNumbers = useMemo(() => {
    const arr: number[] = [];
    for (let p = windowStart; p <= windowEnd; p++) arr.push(p);
    return arr;
  }, [windowStart, windowEnd]);

  const checkedCount = Object.keys(checkedMap).length;

  if (!open) return null;

  function toggleChecked(a: ArticleRow) {
    setCheckedMap((prev) => {
      const next = { ...prev };
      if (next[a.id]) delete next[a.id];
      else next[a.id] = a;
      return next;
    });
  }

  function submitSearch() {
    setPage(1);
    setQuery(queryInput);
  }

  function confirmSelection() {
    onSelect(Object.values(checkedMap));
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">관련기사 선택</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
            ✕
          </button>
        </div>

        <div className="p-4 border-b border-gray-100 flex gap-2">
          <input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
            placeholder="제목 / 기자명으로 발행된 기사 검색"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={submitSearch}
            className="text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg px-4 py-2 hover:border-brand"
          >
            검색
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="text-sm text-gray-400 px-4 py-6">불러오는 중…</p>}
          {!loading && articles.length === 0 && (
            <p className="text-sm text-gray-400 px-4 py-6">검색 결과가 없습니다.</p>
          )}
          {!loading && articles.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="w-10 py-2 pl-4"></th>
                  <th className="text-left py-2 font-semibold">기사제목</th>
                  <th className="w-32 text-left py-2 pr-4 font-semibold">최종편집일</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => {
                  const checked = !!checkedMap[a.id];
                  return (
                    <tr
                      key={a.id}
                      onClick={() => toggleChecked(a)}
                      className={`border-b border-gray-50 cursor-pointer ${checked ? 'bg-brand/5' : 'hover:bg-gray-50'}`}
                    >
                      <td className="py-2.5 pl-4">
                        <input type="checkbox" checked={checked} onChange={() => toggleChecked(a)} onClick={(e) => e.stopPropagation()} />
                      </td>
                      <td className="py-2.5 text-gray-700 truncate max-w-[280px]">
                        {a.title} <span className="text-gray-400 text-xs">· {a.author.name}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-400 text-xs">
                        {new Date(a.updatedAt).toLocaleDateString('ko-KR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 py-3 border-t border-gray-100 text-sm">
            <button
              type="button"
              disabled={windowStart === 1}
              onClick={() => setPage(windowStart - 1)}
              className="px-2 py-1 text-gray-400 disabled:opacity-30"
            >
              이전
            </button>
            {pageNumbers.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-full ${p === page ? 'bg-brand text-white font-bold' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              disabled={windowEnd >= totalPages}
              onClick={() => setPage(windowEnd + 1)}
              className="px-2 py-1 text-gray-500 disabled:opacity-30"
            >
              다음
            </button>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage(totalPages)}
              className="px-2 py-1 text-gray-500 disabled:opacity-30"
            >
              맨끝
            </button>
          </div>
        )}

        <div className="p-4 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            disabled={checkedCount === 0}
            onClick={confirmSelection}
            className="text-sm font-bold text-white bg-brand rounded-full px-5 py-2 disabled:opacity-50"
          >
            선택기사 추가 ({checkedCount})
          </button>
        </div>
      </div>
    </div>
  );
}
