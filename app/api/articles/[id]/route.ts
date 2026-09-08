import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { WRITER_ROLES, initialStatusForRole } from '@/lib/roles';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: { author: true, category: true, images: true, comments: true, poll: { include: { options: true } } },
  });

  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.article.update({
    where: { id: params.id },
    data: { viewCount: { increment: 1 } },
  });

  return NextResponse.json(article);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { keywordIds, intent, images, poll, ...rest } = body; // intent: 'autosave' | 'submit' (글쓰기 화면 전용, 그 외 편집은 기존 방식 그대로) / poll: { question, options: string[] } | null

  // 자동저장/제출은 세션 검증 + 본인 글만 — 클라이언트가 다른 사람 글을 건드리지 못하게 함
  if (intent === 'autosave' || intent === 'submit') {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    if (!WRITER_ROLES.includes(user.role as any)) {
      return NextResponse.json({ error: '기사 작성 권한이 없습니다' }, { status: 403 });
    }
    const existing = await prisma.article.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.authorId !== user.id) {
      return NextResponse.json({ error: '본인이 작성한 글만 수정할 수 있습니다' }, { status: 403 });
    }

    if (intent === 'autosave') {
      // 이미 제출(DRAFT)되었거나 발행(PUBLISHED)된 글은 자동저장으로 되돌리지 않음 — 내용만 갱신
      if (existing.status !== 'AUTOSAVE') {
        delete (rest as any).status;
      } else {
        rest.status = 'AUTOSAVE';
      }
    } else {
      // submit: 기자=DRAFT(승인대기), 논설위원/편집장=PUBLISHED(즉시발행)
      const newStatus = initialStatusForRole(user.role, 'submit');
      rest.status = newStatus;
      if (newStatus === 'PUBLISHED' && !existing.publishedAt) rest.publishedAt = new Date();
      rest.isFrontpageTop = !!rest.isFrontpageTop && newStatus === 'PUBLISHED';
    }
  }

  const pollProvided = 'poll' in body; // 필드 자체가 왔을 때만 설문을 건드림 (안 왔으면 기존 설문 유지)
  const validPollOptions: string[] = (poll?.options ?? []).map((o: string) => (o ?? '').trim()).filter(Boolean);
  const wantsPoll = !!poll?.question?.trim() && validPollOptions.length >= 2;

  const updated = await prisma.$transaction(async (tx) => {
    if (rest.isFrontpageTop) {
      await tx.article.updateMany({
        where: { isFrontpageTop: true, NOT: { id: params.id } },
        data: { isFrontpageTop: false },
      });
    }
    if (pollProvided) {
      // 설문은 기사당 1개 — 매번 통째로 교체(기존 삭제 후 새로 생성). 옵션 변경 시 기존 투표는 초기화됨.
      await tx.poll.deleteMany({ where: { articleId: params.id } });
      if (wantsPoll) {
        await tx.poll.create({
          data: {
            articleId: params.id,
            question: poll.question.trim(),
            options: { create: validPollOptions.map((text, i) => ({ text, order: i })) },
          },
        });
      }
    }
    return tx.article.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(keywordIds ? { keywords: { set: keywordIds.map((id: string) => ({ id })) } } : {}),
        // 카드뉴스 이미지 — 매번 전체 목록을 통째로 교체 (순서 포함)
        ...(images
          ? {
              images: {
                deleteMany: {},
                create: images.map((img: { url: string; caption?: string }, i: number) => ({
                  url: img.url,
                  caption: img.caption,
                  order: i,
                })),
              },
            }
          : {}),
      },
      include: { keywords: true, images: true, poll: { include: { options: true } } },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.article.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
