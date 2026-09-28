'use client';

import { useRef, useState } from 'react';
import { SearchIcon } from './icons';

// 카테고리 줄 오른쪽을 가득 채우는 검색창. 접힘 없이 항상 펼쳐져 있다.
export default function HeaderSearch() {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <form
      action="/search"
      role="search"
      className="search-capsule"
      onSubmit={(e) => {
        if (!query.trim()) e.preventDefault();
      }}
    >
      <span className="search-capsule-icon">
        <SearchIcon />
      </span>
      <div className="search-capsule-body">
        <input
          ref={inputRef}
          name="q"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="기사제목, 본문, 기자이름으로 검색해주세요"
          aria-label="기사 검색"
        />
        {query.length > 0 && (
          <button
            type="button"
            className="search-capsule-clear"
            onClick={handleClear}
            title="검색어 지우기"
            aria-label="검색어 지우기"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}
