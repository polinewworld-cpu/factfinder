import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 편집장이 특정 회원의 등급을 변경 (예: 독자 -> 기자)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 회원 등급을 변경할 수 있습니다' }, { status: 403 });
  }

  const { role } = await req.json();
  if (!Object.values(ROLES).includes(role)) {
    return NextResponse.json({ error: '유효하지 않은 등급입니다' }, { status: 400 });
  }

  const updated = await prisma.user.update({ where: { id: params.id }, data: { role } });
  return NextResponse.json(updated);
}

// 편집장이 회원 삭제 (2026-10-08 신설, 관리자 회원·기자관리 화면의 [삭제])
// 쓴 기사가 있는 회원은 유령 계정 처리(목록에서 숨김, 기사·이름 유지) — 2026-10-08 변경.
// 댓글·투표 기록은 함께 삭제, 사진 라이브러리에 올린 사진은 삭제하는 편집장 소유로 넘겨 보존.
// 로그인 연결(Account·Session)·SNS 링크·북마크는 DB 설정상 자동 삭제, 후원 기록은 회원 연결만 끊김.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 회원을 삭제할 수 있습니다' }, { status: 403 });
  }
  if (params.id === user.id) {
    return NextResponse.json({ error: '본인 계정은 삭제할 수 없습니다' }, { status: 400 });
  }

  // 쓴 기사가 있으면 유령 계정으로 — 목록에서 사라지고 로그인 연결도 끊지만 기사·바이라인은 그대로 (2026-10-08 사장님 지시)
  const articleCount = await prisma.article.count({ where: { authorId: params.id } });
  if (articleCount > 0) {
    await prisma.$transaction([
      prisma.account.deleteMany({ where: { userId: params.id } }),
      prisma.session.deleteMany({ where: { userId: params.id } }),
      prisma.user.update({ where: { id: params.id }, data: { ghost: true, legacyClaimEmail: null } }),
    ]);
    return NextResponse.json({ ok: true, ghost: true, articleCount });
  }

  await prisma.$transaction([
    prisma.comment.deleteMany({ where: { userId: params.id } }),
    prisma.pollVote.deleteMany({ where: { userId: params.id } }),
    prisma.photo.updateMany({ where: { uploaderId: params.id }, data: { uploaderId: user.id } }),
    prisma.user.delete({ where: { id: params.id } }),
  ]);
  return NextResponse.json({ ok: true });
}
