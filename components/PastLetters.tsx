'use client';

import { useState } from 'react';
import LinkedText from '@/components/LinkedText';
import PastReportsButton, { type PastItem } from '@/components/PastReportsButton';

type Letter = {
  id: string; // 0-oh-YYYY-MM-DD-HH
  savedAt: string;
  ai: { opening?: string; headline?: string; chatter?: string[]; outletComparison?: string[]; closing?: string };
};

function toItem(l: Letter): PastItem | null {
  const m = l.id.match(/^0-oh-(\d{4}-\d{2}-\d{2})-(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[2]);
  return {
    id: l.id,
    date: m[1],
    order: `${m[1]}-${m[2]}`,
    label: `${hour}시 편지`,
    node: (
      <div className="space-y-3 text-sm text-gray-800 leading-relaxed">
        {l.ai.opening && <p className="font-semibold">{l.ai.opening}</p>}
        {l.ai.headline && (
          <p>
            <LinkedText text={l.ai.headline} />
          </p>
        )}
        {(l.ai.chatter ?? []).length > 0 && (
          <div>
            <h3 className="font-bold text-gray-900 mb-1">오늘 눈에 띈 이야기</h3>
            {(l.ai.chatter ?? []).map((c, i) => (
              <p key={i}>
                · <LinkedText text={c} />
              </p>
            ))}
          </div>
        )}
        {(l.ai.outletComparison ?? []).length > 0 && (
          <div>
            <h3 className="font-bold text-gray-900 mb-1">주요 언론 보도 동향</h3>
            {(l.ai.outletComparison ?? []).map((c, i) => (
              <p key={i}>
                · <LinkedText text={c} />
              </p>
            ))}
          </div>
        )}
        {l.ai.closing && <p>{l.ai.closing}</p>}
      </div>
    ),
  };
}

// 오진실 기자 "지난 보고" 버튼 — 열 때 보관된 지난 편지들을 불러온다 (2026-10-10)
export default function PastLetters() {
  const [items, setItems] = useState<PastItem[]>([]);
  const [loading, setLoading] = useState(false);

  function load() {
    setLoading(true);
    fetch('/api/admin/oh-letters')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setItems(((d?.letters ?? []) as Letter[]).map(toItem).filter(Boolean) as PastItem[]))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }

  return <PastReportsButton items={items} onOpen={load} loading={loading} />;
}
