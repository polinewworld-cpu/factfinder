import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { ROLES, WRITER_ROLES, initialStatusForRole } from '@/lib/roles';
import { deriveExcerpt } from '@/lib/excerpt';
import { resolveAuthorByName } from '@/lib/authorResolve';
import { sanitizeArticleContent } from '@/lib/sanitizeArticle';
import { syncPhotoUsage } from '@/lib/photoBank';
import { validGhostWriterId } from '@/lib/ghostWriter';
import { clampFocal } from '@/lib/cardImage';
import { toFrenchBrackets } from '@/lib/frenchBrackets';
import { PUBLIC_AUTHOR_SELECT } from '@/lib/publicFields';
import { deleteArticleAudio } from '@/lib/blobStorage';

// 공개 조회 — 발행된 기사만 누구나, 초안·임시저장은 글쓴이·편집장만 (2026-10-09: 초안이 누구에게나 보이고
// 기자 이메일·정산 계좌까지 실리던 문제 수정). 조회수는 기사 페이지에서만 센다.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: {
      author: { select: PUBLIC_AUTHOR_SELECT },
      category: true,
      images: true,
      poll: { include: { options: true } },
    },
  });
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (article.status !== 'PUBLISHED') {
    const user = await getCurrentUser();
    if (!user || (user.id !== article.authorId && user.role !== ROLES.CHIEF_EDITOR)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }
  return NextResponse.json(article);
}

// 글쓰기 화면이 보내는 값 중 요청 본문으로 바꿀 수 있는 칸만 — 상태·발행일·조회수·추천수·글쓴이 등은 서버가 정함 (2026-10-09)
const EDITABLE_FIELDS = [
  'title', 'subtitle1', 'subtitle2', 'subtitle3', 'hoverText', 'content', 'categoryId', 'coverImageUrl',
  'coverFocalX', 'coverFocalY', 'coverFeatureFocalX', 'coverFeatureFocalY', 'coverSecondFocalX', 'coverSecondFocalY',
] as const;
const FOCAL_FIELDS = ['coverFocalX', 'coverFocalY', 'coverFeatureFocalX', 'coverFeatureFocalY', 'coverSecondFocalX', 'coverSecondFocalY'] as const;

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  // 2026-10-09: 예전엔 intent(autosave/submit)가 없는 요청은 로그인 검사 없이 통과해 누구나 아무 기사나 고칠 수 있었음.
  // 이제 모든 수정은 로그인 + 글쓴이 본인 또는 편집장만.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (!WRITER_ROLES.includes(user.role as any)) {
    return NextResponse.json({ error: '기사 작성 권한이 없습니다' }, { status: 403 });
  }
  const existing = await prisma.article.findUnique({
    where: { id: params.id },
    include: { poll: { include: { options: { orderBy: { order: 'asc' } } } } },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const isChief = user.role === ROLES.CHIEF_EDITOR;
  // 편집장은 본인이 작성하지 않은 기사도 수정할 수 있음 (2026-09-11, 관리자 "전체 기사" 화면에서 사용)
  if (existing.authorId !== user.id && !isChief) {
    return NextResponse.json({ error: '본인이 작성한 글만 수정할 수 있습니다' }, { status: 403 });
  }

  const body = await req.json();
  const { keywordIds, relatedArticleIds, intent, images, poll, themeTags, authorName, ghostWriterId } = body; // intent: 'autosave' | 'submit' / poll: { question, options: string[] } | null
  if (intent !== 'autosave' && intent !== 'submit') {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
  }

  const data: Record<string, any> = {};
  for (const key of EDITABLE_FIELDS) if (body[key] !== undefined) data[key] = body[key];
  for (const key of FOCAL_FIELDS) if (data[key] !== undefined) data[key] = clampFocal(data[key]);

  // 글쓴이는 편집장의 "글쓴이" 칸(authorName)·유령기자 선택(ghostWriterId)으로만 (2026-10-08, 10-09)
  if (isChief && (authorName !== undefined || ghostWriterId !== undefined)) {
    const id = (await validGhostWriterId(ghostWriterId)) || (authorName !== undefined ? await resolveAuthorByName(authorName) : null);
    if (id) data.authorId = id;
  }

  // 요약문은 별도 입력을 받지 않고 본문에서 자동 추출 — 화면에는 노출하지 않고 RSS용으로만 사용 (2026-09-11)
  // 본문이 바뀌면 "읽어주기" 오디오도 초기화 — 다음 재생 요청 때 새 본문으로 재생성됨 (2026-09-12)
  let staleAudio = false;
  if (typeof data.content === 'string') {
    // 저장 전 항상 새니타이즈 — POST(articles/route.ts)와 동일한 이유
    data.content = sanitizeArticleContent(data.content);
    data.excerpt = deriveExcerpt(data.content);
    if (data.content !== existing.content) {
      data.audioUrl = null;
      staleAudio = true;
    }
  }

  for (const key of ['title', 'subtitle1', 'subtitle2', 'subtitle3', 'hoverText'] as const) {
    if (typeof data[key] === 'string') data[key] = toFrenchBrackets(data[key]);
  }

  if (intent === 'autosave') {
    // 이미 제출(DRAFT)되었거나 발행(PUBLISHED)된 글은 자동저장으로 상태를 되돌리지 않음 — 내용만 갱신
    if (existing.status === 'AUTOSAVE') data.status = 'AUTOSAVE';
  } else {
    // submit: 기자=DRAFT(승인대기), 논설위원/편집장=PUBLISHED(즉시발행)
    const newStatus = initialStatusForRole(user.role, 'submit');
    data.status = newStatus;
    if (newStatus === 'PUBLISHED' && !existing.publishedAt) data.publishedAt = new Date();
    data.isFrontpageTop = !!body.isFrontpageTop && newStatus === 'PUBLISHED';
  }

  // 설문 — 질문·항목이 실제로 바뀌었을 때만 교체. 예전엔 자동저장(15초)마다 지우고 새로 만들어
  // 설문 달린 기사를 고치는 순간 독자 투표가 전부 사라졌음 (2026-10-09)
  const validPollOptions: string[] = (poll?.options ?? []).map((o: string) => (o ?? '').trim()).filter(Boolean);
  const wantsPoll = !!poll?.question?.trim() && validPollOptions.length >= 2;
  const newQuestion = wantsPoll ? toFrenchBrackets(poll.question.trim()) : null;
  const newOptions = validPollOptions.map((text) => toFrenchBrackets(text));
  const pollUnchanged = wantsPoll
    ? !!existing.poll &&
      existing.poll.question === newQuestion &&
      existing.poll.options.length === newOptions.length &&
      existing.poll.options.every((o, i) => o.text === newOptions[i])
    : !existing.poll;
  const replacePoll = 'poll' in body && !pollUnchanged; // 필드 자체가 안 왔으면 기존 설문 유지

  const updated = await prisma.$transaction(async (tx) => {
    if (data.isFrontpageTop) {
      await tx.article.updateMany({
        where: { isFrontpageTop: true, NOT: { id: params.id } },
        data: { isFrontpageTop: false },
      });
    }
    if (replacePoll) {
      await tx.poll.deleteMany({ where: { articleId: params.id } });
      if (wantsPoll) {
        await tx.poll.create({
          data: {
            articleId: params.id,
            question: newQuestion!,
            options: { create: newOptions.map((text, i) => ({ text, order: i })) },
          },
        });
      }
    }
    return tx.article.update({
      where: { id: params.id },
      data: {
        ...data,
        ...(themeTags !== undefined
          ? { themeTags: Array.isArray(themeTags) && themeTags.length ? themeTags.join(',') : null }
          : {}),
        ...(Array.isArray(keywordIds) ? { keywords: { set: keywordIds.map((id: string) => ({ id })) } } : {}),
        // 관련기사 — 매번 선택된 목록으로 통째로 교체 (기능정의서 8.2)
        ...(Array.isArray(relatedArticleIds)
          ? { relatedArticles: { set: relatedArticleIds.map((id: string) => ({ id })) } }
          : {}),
        // 카드뉴스 이미지 — 매번 전체 목록을 통째로 교체 (순서 포함)
        ...(Array.isArray(images)
          ? {
              images: {
                deleteMany: {},
                create: images.map((img: { url: string; caption?: string }, i: number) => ({
                  url: img.url,
                  caption: img.caption ? toFrenchBrackets(img.caption) : img.caption,
                  order: i,
                })),
              },
            }
          : {}),
      },
      include: { keywords: true, images: true, relatedArticles: { select: { id: true } }, poll: { include: { options: true } } },
    });
  });

  // 더 이상 안 쓰는 읽어주기 음성 파일은 저장소에서 지움 (실패해도 저장은 그대로)
  if (staleAudio) await deleteArticleAudio(updated.id).catch(() => {});
  // 사진 뱅크 사용 이력 — 본문·커버·카드뉴스에 들어간 사진 (실패해도 저장은 그대로)
  await syncPhotoUsage(updated.id, updated.content, [updated.coverImageUrl, ...updated.images.map((i) => i.url)]).catch(() => {});

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const existing = await prisma.article.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // 편집장은 모든 기사 삭제 가능, 그 외엔 본인이 작성한 글만 (PUT과 동일한 권한 원칙)
  if (existing.authorId !== user.id && user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '본인이 작성한 글만 삭제할 수 있습니다' }, { status: 403 });
  }

  await prisma.article.delete({ where: { id: params.id } });
  // 읽어주기 음성은 이 기사 전용 파일이라 함께 지움 (사진은 다른 기사·사진 뱅크와 같이 쓸 수 있어 남김)
  await deleteArticleAudio(params.id).catch(() => {});
  return NextResponse.json({ ok: true });
}

// 카드 제목 줄바꿈(cardTitle), 기사 제목 줄바꿈(title), 메인노출 빼기
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const existing = await prisma.article.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const data: { showOnMain?: boolean; title?: string; cardTitle?: string } = {};
  const isChief = user.role === ROLES.CHIEF_EDITOR;
  const isAuthor = existing.authorId === user.id;

  if (typeof body.showOnMain === 'boolean') {
    if (!isChief) return NextResponse.json({ error: '편집장만 변경할 수 있습니다' }, { status: 403 });
    data.showOnMain = body.showOnMain;
  }
  if (typeof body.cardTitle === 'string') {
    if (!isChief) return NextResponse.json({ error: '편집장만 변경할 수 있습니다' }, { status: 403 });
    data.cardTitle = toFrenchBrackets(body.cardTitle);
  }
  if (typeof body.title === 'string') {
    if (!isChief && !isAuthor) {
      return NextResponse.json({ error: '본인이 작성한 글만 수정할 수 있습니다' }, { status: 403 });
    }
    data.title = toFrenchBrackets(body.title);
  }
  if (data.showOnMain === undefined && data.title === undefined && data.cardTitle === undefined) {
    return NextResponse.json({ error: '변경할 값이 필요합니다' }, { status: 400 });
  }

  const updated = await prisma.article.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(updated);
}
