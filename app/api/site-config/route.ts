import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 사이트 전역 설정 — 기사 본문 삽입 광고 개수(기능정의서 5) + 애드센스 설정. 싱글턴 row.
export async function GET() {
  const config = await prisma.siteConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
  return NextResponse.json(config);
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 설정을 변경할 수 있습니다' }, { status: 403 });
  }

  // 보낸 항목만 바꿈 — 배너 탭은 articleBannerCount, 애드센스 탭은 adsense* (2026-10-09)
  const body = await req.json();
  const data: Record<string, number | boolean> = {};
  if (body.articleBannerCount !== undefined) data.articleBannerCount = Math.max(0, Math.min(3, Number(body.articleBannerCount) || 0));
  for (const key of ['adsenseEnabled', 'adsenseOnHome', 'adsenseOnArticle', 'adsenseOnOther'] as const) {
    if (typeof body[key] === 'boolean') data[key] = body[key];
  }

  const config = await prisma.siteConfig.upsert({
    where: { id: 'singleton' },
    update: data,
    create: { id: 'singleton', ...data },
  });
  return NextResponse.json(config);
}
