import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

const HOMEPAGE_PLACEMENTS = ['HOMEPAGE_3', 'HOMEPAGE_5', 'HOMEPAGE_7'];

// 배너 목록 — 공개(홈화면/기사페이지에서 노출용으로 조회), placement로 필터 가능 (기능정의서 5)
export async function GET(req: NextRequest) {
  const placement = req.nextUrl.searchParams.get('placement');
  const activeOnly = req.nextUrl.searchParams.get('active') === 'true';

  const banners = await prisma.banner.findMany({
    where: {
      ...(placement ? { placement: placement as any } : {}),
      ...(activeOnly ? { active: true } : {}),
    },
    orderBy: [{ placement: 'asc' }, { order: 'asc' }],
  });
  return NextResponse.json(banners);
}

// 배너 등록 — 편집장 전용. 홈화면 슬롯(3/5/7)은 슬롯당 활성 배너 1개만 유지 (기능정의서 5)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 배너를 등록할 수 있습니다' }, { status: 403 });
  }

  const { placement, imageUrl, linkUrl, order, active } = await req.json();
  if (!placement || !imageUrl || !linkUrl) {
    return NextResponse.json({ error: 'placement, imageUrl, linkUrl은 필수입니다' }, { status: 400 });
  }

  const wantsActive = active !== false;

  const banner = await prisma.$transaction(async (tx) => {
    if (wantsActive && HOMEPAGE_PLACEMENTS.includes(placement)) {
      // 홈화면 슬롯은 위치당 활성 배너 1개만 유지 — 새로 등록 전 같은 슬롯의 기존 활성 배너는 비활성화
      await tx.banner.updateMany({ where: { placement, active: true }, data: { active: false } });
    }
    return tx.banner.create({
      data: { placement, imageUrl, linkUrl, order: order ?? 0, active: wantsActive },
    });
  });
  return NextResponse.json(banner, { status: 201 });
}
