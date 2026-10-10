import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { retiredUserData } from '@/lib/retireUser';

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
}

// 회원 탈퇴 (2026-10-08) — 본인 요청으로 계정 정리. 편집장은 사고 방지를 위해 탈퇴 불가(다른 편집장이 등급을 내린 뒤 가능).
//  · 쓴 기사가 있으면 유령 계정: 로그인 연결·개인정보(이메일 외 사진·소개·SNS)를 지우고 목록에서 숨김, 기사·이름은 유지
//  · 쓴 기사가 없으면 계정 삭제 (댓글·투표·저장 함께 삭제, 후원 기록은 회원 연결만 끊김 — 결제기록 5년 보관 의무)
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role === 'CHIEF_EDITOR') {
    return NextResponse.json({ error: '편집장 계정은 탈퇴할 수 없습니다. 다른 편집장에게 등급 변경을 요청해주세요.' }, { status: 400 });
  }

  const articleCount = await prisma.article.count({ where: { authorId: user.id } });
  const common = [
    prisma.account.deleteMany({ where: { userId: user.id } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.savedArticle.deleteMany({ where: { userId: user.id } }),
    prisma.snsLink.deleteMany({ where: { userId: user.id } }),
  ];
  if (articleCount > 0) {
    await prisma.$transaction([
      ...common,
      prisma.user.update({
        where: { id: user.id },
        data: { ...(await retiredUserData(user.id)), image: null, bio: null, newsletterOptIn: false },
      }),
    ]);
  } else {
    await prisma.$transaction([
      ...common,
      prisma.comment.deleteMany({ where: { userId: user.id } }),
      prisma.pollVote.deleteMany({ where: { userId: user.id } }),
      prisma.photo.deleteMany({ where: { uploaderId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);
  }
  return NextResponse.json({ ok: true });
}
