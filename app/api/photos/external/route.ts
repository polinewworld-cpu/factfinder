import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WRITER_ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { searchExternal, externalAvailable, type ExternalSource } from '@/lib/externalPhotos';

// 사진 뱅크 외부 검색 (2026-10-09, 2단계) — ?source=wikimedia|flickr|dvids|naver&q=
// 이미 뱅크에 있는 사진(같은 원본 URL)은 inBank로 표시
const SOURCES: ExternalSource[] = ['wikimedia', 'flickr', 'dvids', 'naver'];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(WRITER_ROLES as readonly string[]).includes(user.role)) {
    return NextResponse.json({ error: '기자 이상만 쓸 수 있습니다' }, { status: 403 });
  }
  const source = req.nextUrl.searchParams.get('source') as ExternalSource;
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!SOURCES.includes(source)) {
    // 출처별 사용 가능 여부만
    return NextResponse.json(Object.fromEntries(SOURCES.map((s) => [s, externalAvailable(s)])));
  }
  if (!q) return NextResponse.json({ source, available: externalAvailable(source), items: [] });

  const result = await searchExternal(source, q);
  const urls = result.items.map((i) => i.pageUrl);
  const existing = urls.length
    ? await prisma.photo.findMany({ where: { sourceUrl: { in: urls } }, select: { sourceUrl: true } })
    : [];
  const inBank = new Set(existing.map((e) => e.sourceUrl));
  // 최신 사진 먼저 (촬영일 있는 것끼리 최신순, 날짜 없는 건 뒤로 — 원래 순서 유지) (2026-10-10)
  const items = result.items
    .map((i, idx) => ({ ...i, inBank: inBank.has(i.pageUrl), idx }))
    .sort((a, b) => (b.takenAt ?? '').localeCompare(a.takenAt ?? '') || a.idx - b.idx)
    .map(({ idx: _idx, ...i }) => i);
  return NextResponse.json({ ...result, items });
}
