'use client';

import { useEffect, useMemo, useState } from 'react';

type SpecialChar = { id: string; char: string; label?: string | null; category: string };

const PREFERRED_ORDER = ['자주쓰는', '화살표', '단위'];
// 등록된 문자가 이 개수보다 적으면(최초 오픈 등) 기본 100개 세트를 1회성으로 자동 시딩한다.
// 시딩은 서버에서 idempotent하게 처리되므로 여러 번 호출돼도 안전함 (SpecialCharacterModal의 동작 설명은 인수인계서 참고)
const SEED_THRESHOLD = 50;

// 에디터 안에서 여는 특수문자 삽입/관리 레이어 (2026-09-11: 관리자 메뉴의 특수문자 관리를 대체)
// - 아무나(작성 권한자) 문자를 클릭해 커서 위치에 삽입 가능, 모달은 닫히지 않고 계속 열려 있어 연속 삽입 가능
// - 편집장(canManage)만 카테고리별로 새 문자 추가/삭제 가능. 카테고리 입력창에 없는 이름을 적으면 새 탭이 생김("카테고리 관리")
export default function SpecialCharacterModal({
  open,
  onClose,
  onSelect,
  canManage,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (char: string) => void;
  canManage: boolean;
}) {
  const [chars, setChars] = useState<SpecialChar[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('자주쓰는');

  const [newChar, setNewChar] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/special-characters');
        let list: SpecialChar[] = res.ok ? await res.json() : [];
        if (list.length < SEED_THRESHOLD) {
          // 최초 오픈(또는 거의 비어있을 때) — 기본 100개 세트 자동 시딩. 실패해도 무시(이미 있는 건 그대로 사용)
          const seedRes = await fetch('/api/special-characters/seed', { method: 'POST' });
          if (seedRes.ok) {
            const res2 = await fetch('/api/special-characters');
            if (res2.ok) list = await res2.json();
          }
        }
        setChars(list);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const categories = useMemo(() => {
    const present = new Set(chars.map((c) => c.category));
    const preferred = PREFERRED_ORDER.filter((c) => present.has(c));
    const rest = [...present].filter((c) => !PREFERRED_ORDER.includes(c)).sort((a, b) => a.localeCompare(b, 'ko'));
    return [...preferred, ...rest];
  }, [chars]);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(activeCategory)) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  if (!open) return null;

  const visibleChars = chars.filter((c) => c.category === activeCategory);

  async function addChar() {
    const char = newChar.trim();
    const category = (newCategory.trim() || activeCategory || '자주쓰는');
    if (!char) return;
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/special-characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ char, label: newLabel.trim() || undefined, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? '특수문자 추가에 실패했습니다.');
        return;
      }
      setChars((prev) => [...prev, data]);
      setActiveCategory(category);
      setNewChar('');
      setNewLabel('');
      setNewCategory('');
    } finally {
      setBusy(false);
    }
  }

  async function deleteChar(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/special-characters/${id}`, { method: 'DELETE' });
      setChars((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">특수문자</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
            ✕
          </button>
        </div>

        {categories.length > 0 && (
          <div className="px-4 pt-3 flex flex-wrap gap-1.5 border-b border-gray-100 pb-3">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`text-xs font-bold rounded-full px-3 py-1 border ${
                  activeCategory === cat ? 'bg-brand text-white border-brand' : 'bg-white text-gray-500 border-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="p-4 overflow-y-auto flex-1">
          {loading && <p className="text-sm text-gray-400">불러오는 중…</p>}
          {!loading && visibleChars.length === 0 && (
            <p className="text-sm text-gray-400">이 카테고리에 등록된 문자가 없습니다.</p>
          )}
          <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
            {visibleChars.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => onSelect(c.char)}
                title={c.label ?? undefined}
                className="relative aspect-square rounded-lg border border-gray-200 text-lg flex items-center justify-center hover:border-brand hover:bg-brand/5"
              >
                {c.char}
                {canManage && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChar(c.id);
                    }}
                    title="삭제"
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gray-400 hover:bg-red-500 text-white text-[10px] leading-4 text-center"
                  >
                    ✕
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {canManage && (
          <div className="p-3 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <input
                value={newChar}
                onChange={(e) => setNewChar(e.target.value)}
                placeholder="문자"
                className="w-14 text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-brand text-center"
              />
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="설명 (선택)"
                className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-brand"
              />
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addChar()}
                placeholder={`카테고리 (기본 ${activeCategory})`}
                list="special-char-categories"
                className="w-28 shrink-0 text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-brand"
              />
              <datalist id="special-char-categories">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
              <button
                type="button"
                disabled={busy}
                onClick={addChar}
                className="shrink-0 text-xs font-bold text-white bg-brand rounded-lg px-3 py-2 disabled:opacity-50"
              >
                + 추가
              </button>
            </div>
            {errorMsg && <p className="text-red-600 text-xs mt-1.5">{errorMsg}</p>}
            <p className="text-[11px] text-gray-400 mt-1.5">
              새 카테고리 이름을 입력하면 위에 새 탭이 생깁니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
