import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  const full = await prisma.user.findUnique({ where: { id: user.id }, include: { snsLinks: { orderBy: { order: 'asc' } } } });
  return NextResponse.json(full ?? user);
}

// 회원 본인이 닉네임/프로필사진/자기소개/SNS링크를 직접 설정 (등급 변경은 편집장 전용 /api/users/[id]에서만 가능)
// 닉네임: 필수 입력 + 중복 불허 (기능정의서 2번)
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const { nickname, image, bio, snsLinks, newsletterOptIn } = await req.json();

  if (nickname !== undefined && !nickname?.trim()) {
    return NextResponse.json({ error: '닉네임은 필수 입력입니다' }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: user.id },
        data: {
          ...(nickname !== undefined ? { nickname: nickname.trim() } : {}),
          ...(image !== undefined ? { image: image || null } : {}),
          ...(bio !== undefined ? { bio: bio?.trim() || null } : {}),
          ...(newsletterOptIn !== undefined ? { newsletterOptIn: !!newsletterOptIn } : {}),
        },
      });

      // SNS 링크는 "+" 버튼으로 추가/삭제되는 가변 목록이라 매번 전체 교체
      if (Array.isArray(snsLinks)) {
        await tx.snsLink.deleteMany({ where: { userId: user.id } });
        const urls = snsLinks.map((u: string) => (u ?? '').trim()).filter(Boolean);
        if (urls.length > 0) {
          await tx.snsLink.createMany({
            data: urls.map((url: string, i: number) => ({ userId: user.id, url, order: i })),
          });
        }
      }

      return tx.user.findUnique({ where: { id: user.id }, include: { snsLinks: { orderBy: { order: 'asc' } } } });
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: '이미 사용 중인 닉네임입니다' }, { status: 409 });
    }
    throw e;
  }
}
