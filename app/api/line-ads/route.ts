import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 줄광고 — 기사 본문 맨 마지막에 핫핑크 화살표 + 굵은 한 줄 문안으로 노출되는 텍스트형 광고 (2026-09-12 신설)
// GET: 공개 조회. ?active=true면 활성 항목만 order순으로, 화면에는 최대 10개까지만 노출(take 파라미터 없이도 기본 10개 캡)
export async function GET(req: NextRequest) {
  const activeOnly = req.nextUrl.searchParams.get('active') === 'true';
  const lineAds = await prisma.lineAd.findMany({
    where: activeOnly ? { active: true } : {},
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    ...(activeOnly ? { take: 10 } : {}),
  });
  return NextResponse.json(lineAds);
}

// 등록 — 편집장 전용
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 줄광고를 등록할 수 있습니다' }, { status: 403 });
  }

  const { text, linkUrl, order } = await req.json();
  if (!text?.trim() || !linkUrl?.trim()) {
    return NextResponse.json({ error: '문안과 링크는 필수입니다' }, { status: 400 });
  }

  const lineAd = await prisma.lineAd.create({
    data: { text: text.trim(), linkUrl: linkUrl.trim(), order: order ?? 0 },
  });
  return NextResponse.json(lineAd, { status: 201 });
}
