'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type TagOption = { id: string; name: string };

export default function TagMultiSelect({
  label,
  options,
  selectedIds,
  onToggle,
  onCreate,
  creating = false,
  canCreate = true,
  multiple = true,
  searchable,
  placeholder = '선택',
}: {
  label: string;
  options: TagOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onCreate?: (name: string) => void | Promise<void>;
  creating?: boolean;
  canCreate?: boolean;
  multiple?: boolean;
  searchable?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showSearch = searchable ?? (multiple || canCreate);
  const selected = useMemo(
    () => options.filter((o) => selectedIds.includes(o.id)),
    [options, selectedIds]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const exactMatch = useMemo(() => {
    const q = query.trim();
    if (!q) return true;
    return options.some((o) => o.name === q);
  }, [options, query]);

  const summary = selected.length === 0 ? placeholder : selected.map((s) => s.name).join(', ');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const t = showSearch ? window.setTimeout(() => inputRef.current?.focus(), 0) : 0;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, showSearch]);

  async function createFromQuery() {
    const name = query.trim();
    if (!name || !canCreate || !onCreate || exactMatch || creating) return;
    await onCreate(name);
    setQuery('');
  }

  function pick(id: string) {
    onToggle(id);
    if (!multiple) setOpen(false);
  }

  return (
    <div className="tag-select" ref={rootRef}>
      <span className="tag-select-label">{label}</span>
      <div className="tag-select-field">
        <button
          type="button"
          className={`tag-select-trigger${selected.length ? '' : ' is-empty'}${open ? ' is-open' : ''}`}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="tag-select-value">{summary}</span>
          <span className="tag-select-caret" aria-hidden="true" />
        </button>
        {open ? (
          <div className="tag-select-menu" role="listbox" aria-multiselectable={multiple}>
            {showSearch ? (
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (canCreate && query.trim() && !exactMatch) {
                      void createFromQuery();
                      return;
                    }
                    if (filtered[0]) pick(filtered[0].id);
                  }
                }}
                placeholder={canCreate ? '검색 또는 새로 만들기' : '검색'}
                className="tag-select-search"
              />
            ) : null}
            <div className="tag-select-list">
              {filtered.length === 0 && (exactMatch || !canCreate) ? (
                <p className="tag-select-empty">항목이 없습니다.</p>
              ) : null}
              {filtered.map((o) => {
                const on = selectedIds.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`tag-select-option${on ? ' is-on' : ''}`}
                    onClick={() => pick(o.id)}
                  >
                    <span className="tag-select-check" aria-hidden="true" />
                    {o.name}
                  </button>
                );
              })}
            </div>
            {canCreate && onCreate && query.trim() && !exactMatch ? (
              <button
                type="button"
                className="tag-select-create"
                disabled={creating}
                onClick={() => void createFromQuery()}
              >
                {creating ? '추가 중…' : `\u201c${query.trim()}\u201d 만들기`}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
