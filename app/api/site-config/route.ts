import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 사이트 전역 설정 — 지금은 기사 본문 삽입 광고 개수만 (기능정의서 5). 싱글턴 row.
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

  const { articleBannerCount } = await req.json();
  const count = Math.max(0, Math.min(3, Number(articleBannerCount) || 0));

  const config = await prisma.siteConfig.upsert({
    where: { id: 'singleton' },
    update: { articleBannerCount: count },
    create: { id: 'singleton', articleBannerCount: count },
  });
  return NextResponse.json(config);
}
