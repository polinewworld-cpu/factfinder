import { NextResponse } from 'next/server';

// 헤더에 넣을 실시간 코스피 지수 / 원달러 환율을 가져오는 간단한 API.
// 별도 API 키가 필요 없는 야후 파이낸스 공개 차트 엔드포인트를 사용한다.
// 이 값은 부가 정보이므로 실패하더라도 헤더 전체가 깨지지 않도록 조용히 null을 반환한다.

export const revalidate = 60;

type Quote = { price: number; change: number; changePercent: number } | null;

async function fetchQuote(symbol: string): Promise<Quote> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        next: { revalidate: 60 },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (typeof price !== 'number') return null;
    const prevClose = meta?.previousClose ?? meta?.chartPreviousClose;
    if (typeof prevClose !== 'number' || prevClose === 0) {
      return { price, change: 0, changePercent: 0 };
    }
    const change = price - prevClose;
    const changePercent = (change / prevClose) * 100;
    return { price, change, changePercent };
  } catch {
    return null;
  }
}

export async function GET() {
  const [kospi, usdkrw] = await Promise.all([fetchQuote('^KS11'), fetchQuote('KRW=X')]);

  return NextResponse.json(
    { kospi, usdkrw, updatedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } }
  );
}
