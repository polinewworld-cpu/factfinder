import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { WRITER_ROLES } from '@/lib/roles';
import { latestForeignNews, refreshForeignNews } from '@/lib/foreignNews';

// 관리자 "외신 추천" 데이터 (2026-10-10) — 저장된 최신 결과를 주고, ?refresh=1 이면 지금 새로 모은다(기자 이상).
// 한국 관련 이슈를 다룬 영미 주요 외신만 — 선별·번역·요약은 lib/foreignNews.ts
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (!(WRITER_ROLES as readonly string[]).includes(user.role)) return NextResponse.json({ error: '기자 이상만 볼 수 있습니다' }, { status: 403 });

  try {
    const latest = await latestForeignNews();
    if (req.nextUrl.searchParams.get('refresh') === '1' || !latest) {
      return NextResponse.json({ report: await refreshForeignNews() });
    }
    return NextResponse.json({ report: latest });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '외신 수집 중 오류' }, { status: 502 });
  }
}
