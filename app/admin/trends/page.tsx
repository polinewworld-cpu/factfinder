'use client';

import AnalyticsView from '@/components/AnalyticsView';

// 관리자 "동향 보고" (2026-10-09 방문 분석에서 분리) — 오늘의 키워드 → 기사 아이디어 → 주요 언론 보도 동향 → 주요 언론 지면. 3시간마다 자동 갱신
export default function TrendsPage() {
  return <AnalyticsView view="trends" />;
}
