import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { ROLES } from '@/lib/roles';
import { gaConfigured } from '@/lib/ga';
import { buildAndSaveToday, latestSnapshot, refreshMediaToday } from '@/lib/analyticsSnapshot';

// 관리자 "방문 분석" 데이터 (2026-10-08) — 저장된 최신 보고서를 주고, ?refresh=1 이면 지금 GA에서 새로 만든다.
// ?media=1 이면 매체 동향·기사 아이디어만 새로.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) return NextResponse.json({ error: '편집장만 볼 수 있습니다' }, { status: 403 });
  if (!gaConfigured()) return NextResponse.json({ configured: false });

  try {
    // ?media=1 — 오늘의 키워드·지면·기사 아이디어만 지금 새로 (2026-10-09)
    if (req.nextUrl.searchParams.get('media') === '1') {
      return NextResponse.json({ configured: true, report: await refreshMediaToday() });
    }
    const latest = await latestSnapshot();
    if (req.nextUrl.searchParams.get('refresh') === '1' || !latest) {
      const report = await buildAndSaveToday();
      return NextResponse.json({ configured: true, report });
    }
    return NextResponse.json({ configured: true, report: latest.data });
  } catch (e) {
    return NextResponse.json({ configured: true, error: e instanceof Error ? e.message : 'GA 조회 중 오류' }, { status: 502 });
  }
}
