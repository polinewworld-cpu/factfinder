'use client';

import AnalyticsView from '@/components/AnalyticsView';

// 관리자 "방문 분석" — GA 방문 숫자·인사이트·그래프 (매일 아침). 매체 동향·기사 아이디어는 "동향 보고"(/admin/trends)로 분리(2026-10-09)
export default function AnalyticsPage() {
  return <AnalyticsView view="visits" />;
}
