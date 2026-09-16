'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// 기사 카드(그리드)에서 이미 저장한 기사인지(책갈피 채움 여부)를 알려주기 위한 전역 컨텍스트.
// 로그인 시 1회 /api/me/saved-ids로 저장된 기사 id 목록만 가볍게 받아오고,
// 카드에서 저장/취소할 때마다 이 컨텍스트도 같이 갱신해 다른 카드에도 즉시 반영되게 한다.
type SavedArticlesContextValue = {
  loggedIn: boolean;
  isChiefEditor: boolean;
  isSaved: (articleId: string) => boolean;
  setSaved: (articleId: string, saved: boolean) => void;
};

const SavedArticlesContext = createContext<SavedArticlesContextValue>({
  loggedIn: false,
  isChiefEditor: false,
  isSaved: () => false,
  setSaved: () => {},
});

export function useSavedArticles() {
  return useContext(SavedArticlesContext);
}

export default function SavedArticlesProvider({
  children,
  loggedIn,
  isChiefEditor = false,
}: {
  children: React.ReactNode;
  loggedIn: boolean;
  isChiefEditor?: boolean;
}) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loggedIn) return;
    fetch('/api/me/saved-ids')
      .then((res) => (res.ok ? res.json() : []))
      .then((ids: string[]) => setSavedIds(new Set(ids)))
      .catch(() => {});
  }, [loggedIn]);

  const isSaved = useCallback((articleId: string) => savedIds.has(articleId), [savedIds]);

  const setSaved = useCallback((articleId: string, saved: boolean) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(articleId);
      else next.delete(articleId);
      return next;
    });
  }, []);

  return (
    <SavedArticlesContext.Provider value={{ loggedIn, isChiefEditor, isSaved, setSaved }}>
      {children}
    </SavedArticlesContext.Provider>
  );
}
