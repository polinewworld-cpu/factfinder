'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SearchIcon } from './icons';

// 헤더 검색창 — 평소엔 동그란 돋보기 버튼, 마우스를 올리거나 클릭/⌘K(Ctrl+K)하면 캡슐로 펼쳐짐.
// 제출은 기존과 동일하게 /search?q= 로 이동.
export default function HeaderSearch() {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [wantFocus, setWantFocus] = useState(false);
  const [query, setQuery] = useState('');
  const [isMac, setIsMac] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const isExpanded = isHovered || isFocused || wantFocus || query.length > 0;

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setWantFocus(true);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 접힌 상태에선 input이 아직 없으므로, 펼쳐져 렌더된 뒤에 포커스
  useEffect(() => {
    if (wantFocus && inputRef.current) {
      inputRef.current.focus();
      setWantFocus(false);
    }
  });

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="search-wrap">
      <motion.form
        action="/search"
        role="search"
        className={`search-capsule${isExpanded ? ' is-expanded' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => {
          setWantFocus(true);
          inputRef.current?.focus();
        }}
        onSubmit={(e) => {
          if (!query.trim()) e.preventDefault();
        }}
        initial={false}
        animate={{ width: isExpanded ? '100%' : 52 }}
        transition={{ type: 'spring', stiffness: 340, damping: 26 }}
      >
        <motion.span
          className="search-capsule-icon"
          initial={false}
          animate={{ scale: isExpanded ? 1.08 : 1, color: isExpanded ? '#ff2d8a' : '#6B7280' }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <SearchIcon />
        </motion.span>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="search-capsule-body"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <input
                ref={inputRef}
                name="q"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="기사제목, 본문, 기자이름으로 검색해주세요"
                aria-label="기사 검색"
              />
              {query.length > 0 ? (
                <motion.button
                  type="button"
                  className="search-capsule-clear"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleClear}
                  title="검색어 지우기"
                  aria-label="검색어 지우기"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </motion.button>
              ) : (
                <kbd className="search-capsule-kbd">{isMac ? '⌘ K' : 'Ctrl K'}</kbd>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.form>
    </div>
  );
}
