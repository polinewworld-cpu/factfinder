'use client';

import { useEffect, useMemo, useState } from 'react';

type Me = { id: string; role: string };
type Category = { id: string; name: string };
type Row = {
  id: string;
  title: string;
  status: 'AUTOSAVE' | 'DRAFT' | 'PUBLISHED';
  viewCount: number;
  isFrontpageTop: boolean;
  showOnMain: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  author: { id: string; name: string };
  category: { id: string; name: string } | null;
  commentCount: number;
};

type SortField = 'title' | 'status' | 'viewCount' | 'commentCount' | 'createdAt' | 'updatedAt' | 'publishedAt';

const STATUS_LABEL: Record<Row['status'], string> = {
  PUBLISHED: '발행',
  DRAFT: '승인대기',
  AUTOSAVE: '임시저장',
};
const STATUS_STYLE: Record<Row['status'], string> = {
  PUBLISHED: 'bg-green-50 text-green-700 border-green-200',
  DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
  AUTOSAVE: 'bg-gray-100 text-gray-500 border-gray-200',
};

const PAGE_SIZE = 20;
const PAGE_WINDOW = 10;

function fmtDateTime(v: string | null) {
  if (!v) return '-';
  return new Date(v).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// 관리자 "전체 기사" — 상태 무관 전체 기사를 검색+정렬+페이지네이션으로 관리 (2026-09-11 신설)
// 사용자 지시: 검색 영역은 한 줄로 압축, 정렬은 필수, 제목을 눌러 어떤 기사든 편집장이 바로 수정 가능해야 함.
export default function AdminArticlesPage() {
  const [me, setMe] = useState<Me | null | 'loading'>('loading');
  const [categories, setCategories] = useState<Category[]>([]);

  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [categoryId, setCategoryId] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/me');
      setMe(meRes.ok ? await meRes.json() : null);
      const catRes = await fetch('/api/categories');
      if (catRes.ok) setCategories(await catRes.json());
    })();
  }, []);

  useEffect(() => {
    if (me === 'loading' || !me) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (status !== 'ALL') params.set('status', status);
    if (categoryId) params.set('categoryId', categoryId);
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    fetch(`/api/admin/articles?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { articles: [], total: 0 }))
      .then((data) => {
        setRows(data.articles ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [me, query, status, categoryId, sortBy, sortDir, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const windowStart = Math.floor((page - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1;
  const windowEnd = Math.min(totalPages, windowStart + PAGE_WINDOW - 1);
  const pageNumbers = useMemo(() => {
    const arr: number[] = [];
    for (let p = windowStart; p <= windowEnd; p++) arr.push(p);
    return arr;
  }, [windowStart, windowEnd]);

  // 카드 (-) 버튼으로 메인에서 제외된 기사를 다시 노출시키는 복구용 토글 (2026-09-12 신설)
  async function toggleShowOnMain(row: Row) {
    const res = await fetch(`/api/articles/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showOnMain: !row.showOnMain }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, showOnMain: updated.showOnMain } : r)));
  }

  function submitSearch() {
    setPage(1);
    setQuery(queryInput);
  }

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(1);
  }

  function SortTh({ field, label, className }: { field: SortField; label: string; className?: string }) {
    const active = sortBy === field;
    return (
      <th className={`py-2 font-semibold select-none ${className ?? ''}`}>
        <button
          type="button"
          onClick={() => toggleSort(field)}
          className={`inline-flex items-center gap-0.5 hover:text-gray-900 ${active ? 'text-gray-900' : 'text-gray-400'}`}
        >
          {label}
          <span className="text-[10px]">{active ? (sortDir === 'asc' ? '▲' : '▼') : '▵'}</span>
        </button>
      </th>
    );
  }

  if (me === 'loading') return <main className="px-4 py-10 text-gray-500">불러오는 중…</main>;
  if (!me || me.role !== 'CHIEF_EDITOR') {
    return (
      <main className="px-4 py-10">
        <p className="text-gray-600">편집장만 접근할 수 있는 화면입니다.</p>
      </main>
    );
  }

  return (
    <main className="px-4 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-gray-900">전체 기사</h1>
        <span className="text-xs text-gray-400">전체 {total.toLocaleString('ko-KR')}건</span>
      </div>

      {/* 검색/필터 — 한 줄로 압축 (2026-09-11 사용자 지시: 공간 낭비 없이 집약적으로) */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <input
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
          placeholder="제목 · 작성자 검색"
          className="flex-1 min-w-[160px] text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-brand"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-brand"
        >
          <option value="ALL">전체 상태</option>
          <option value="PUBLISHED">발행</option>
          <option value="DRAFT">승인대기</option>
          <option value="AUTOSAVE">임시저장</option>
        </select>
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-brand"
        >
          <option value="">전체 카테고리</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={submitSearch}
          className="text-sm font-semibold text-white bg-brand rounded-lg px-4 py-1.5 hover:bg-brand-dark"
        >
          검색
        </button>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-sm border-collapse min-w-[720px]">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-200 bg-gray-50">
              <SortTh field="title" label="제목" className="pl-4 pr-4" />
              <th className="py-2 pr-4 font-semibold">카테고리</th>
              <th className="py-2 pr-4 font-semibold">작성자</th>
              <SortTh field="status" label="상태" className="pr-4" />
              <SortTh field="viewCount" label="조회수" className="pr-4" />
              <SortTh field="commentCount" label="댓글수" className="pr-4" />
              <th className="py-2 pr-4 font-semibold">메인노출</th>
              <SortTh field="updatedAt" label="최종편집일" className="pr-4" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-400">
                  불러오는 중…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-400">
                  검색 결과가 없습니다.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 pl-4 pr-4 max-w-[320px]">
                    <a href={`/write?id=${r.id}`} className="font-medium text-gray-900 hover:text-brand truncate block">
                      {r.isFrontpageTop && <span className="text-brand mr-1">★</span>}
                      {r.title || '(제목 없음)'}
                    </a>
                  </td>
                  <td className="py-2 pr-4 text-gray-500">{r.category?.name ?? '-'}</td>
                  <td className="py-2 pr-4 text-gray-500">{r.author?.name ?? '-'}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${STATUS_STYLE[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-500">{r.viewCount.toLocaleString('ko-KR')}</td>
                  <td className="py-2 pr-4 text-gray-500">{r.commentCount.toLocaleString('ko-KR')}</td>
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleShowOnMain(r)}
                      className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${
                        r.showOnMain
                          ? 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                          : 'bg-brand/10 text-brand border-brand/30 hover:bg-brand/20'
                      }`}
                      title={r.showOnMain ? '메인에서 제외' : '메인에 다시 노출'}
                    >
                      {r.showOnMain ? '노출중' : '메인제외됨 · 복구'}
                    </button>
                  </td>
                  <td className="py-2 pr-4 text-gray-400 text-xs">{fmtDateTime(r.updatedAt)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 py-4 text-sm">
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
    </main>
  );
}
