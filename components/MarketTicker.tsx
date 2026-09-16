'use client';

import { useEffect, useState } from 'react';

// 헤더의 전체기사/알림/후원하기 자리를 대신해서 보여주는 실시간 코스피·환율 위젯.
// /api/market 을 1분마다 조회한다. 실패해도 헤더가 깨지면 안 되므로 조용히 숨긴다.

type Quote = { price: number; change: number; changePercent: number } | null;
type MarketData = { kospi: Quote; usdkrw: Quote };

function fmt(n: number, digits = 2) {
  return n.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function QuoteItem({ label, q }: { label: string; q: Quote }) {
  if (!q) return null;
  const isUp = q.change > 0;
  const isDown = q.change < 0;
  const arrow = isUp ? '▲' : isDown ? '▼' : '－';
  const colorClass = isUp ? 'market-up' : isDown ? 'market-down' : 'market-flat';

  return (
    <span className="market-item">
      <span className="market-label">{label}</span>
      <span className="market-value">{fmt(q.price)}</span>
      <span className={`market-change ${colorClass}`}>
        {arrow} {fmt(Math.abs(q.changePercent))}%
      </span>
    </span>
  );
}

export default function MarketTicker() {
  const [data, setData] = useState<MarketData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/market', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // 증시 위젯은 부가 정보라 실패해도 조용히 무시한다.
      }
    }

    load();
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!data || (!data.kospi && !data.usdkrw)) return null;

  return (
    <div className="market-ticker" aria-label="실시간 코스피·환율">
      <QuoteItem label="코스피" q={data.kospi} />
      <QuoteItem label="환율" q={data.usdkrw} />
    </div>
  );
}
