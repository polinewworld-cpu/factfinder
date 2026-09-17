import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES, initialStatusForRole } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import type { ArticleStatus } from '@prisma/client';
import { deriveExcerpt } from '@/lib/excerpt';
import { sanitizeArticleContent } from '@/lib/sanitizeArticle';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categorySlug = searchParams.get('category');
  const keyword = searchParams.get('keyword'); // 키워드로 기사 모아보기
  const sort = searchParams.get('sort'); // 'popular'이면 많이 본 기사 순
  const exclude = searchParams.get('exclude'); // 관련기사에서 자기 자신 제외
  const statusParam = searchParams.get('status'); // 'draft' -> 편집장 승인대기함 전용, 그 외엔 항상 공개(PUBLISHED)만
  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '20');

  let status: ArticleStatus = 'PUBLISHED';
  if (statusParam === 'draft') {
    const user = await getCurrentUser();
    if (!user || user.role !== ROLES.CHIEF_EDITOR) {
      return NextResponse.json({ error: '편집장만 승인대기 목록을 볼 수 있습니다' }, { status: 403 });
    }
    status = 'DRAFT';
  }

  const articles = await prisma.article.findMany({
    where: {
      status,
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
      ...(keyword ? { keywords: { some: { name: keyword } } } : {}),
      ...(exclude ? { NOT: { id: exclude } } : {}),
    },
    include: { author: true, category: true, images: true, keywords: true },
    orderBy: status === 'DRAFT' ? { updatedAt: 'desc' } : sort === 'popular' ? { viewCount: 'desc' } : { publishedAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return NextResponse.json(articles);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (![ROLES.REPORTER, ROLES.COLUMNIST, ROLES.CHIEF_EDITOR].includes(user.role as any)) {
    return NextResponse.json({ error: '기사 작성 권한이 없습니다 (기자/논설위원/편집장만 가능)' }, { status: 403 });
  }

  const body = await req.json();
  const {
    title, content, hoverText, themeTags, coverImageUrl, categoryId, images,
    subtitle1, subtitle2, subtitle3, relatedArticleIds,
    keywordIds, isFrontpageTop, intent, poll, // intent: 'autosave' | 'submit' (기본값 submit) / poll: { question, options: string[] } | null
  } = body;
  // 저장 전 항상 새니타이즈 — 렌더링(app/article/[id]/page.tsx)이 dangerouslySetInnerHTML로
  // 그대로 뿌리기 때문에 여기서 걸러지지 않으면 스크립트 태그 등이 방문자 브라우저에서 그대로 실행됨
  const safeContent = sanitizeArticleContent(content ?? '');
  // 요약문은 별도 입력을 받지 않고 본문에서 자동 추출 — 화면에는 노출하지 않고 RSS용으로만 사용 (2026-09-11)
  const excerpt = deriveExcerpt(safeContent);
  const authorId = user.id; // 클라이언트가 임의로 다른 사람 행세 못하도록 세션에서만 가져옴

  // intent='autosave' -> 작성중 임시저장(AUTOSAVE), 'submit' -> 기자=DRAFT(승인대기)/논설위원·편집장=PUBLISHED(즉시발행)
  const status = initialStatusForRole(user.role, intent === 'autosave' ? 'autosave' : 'submit');
  const wantsFrontpageTop = !!isFrontpageTop && status === 'PUBLISHED'; // 미승인 초안은 1면톱 지정 불가

  // 설문(투표) — 질문 + 유효한(공백아닌) 옵션 2개 이상일 때만 실제 생성
  const validPollOptions: string[] = (poll?.options ?? []).map((o: string) => (o ?? '').trim()).filter(Boolean);
  const wantsPoll = !!poll?.question?.trim() && validPollOptions.length >= 2;

  const article = await prisma.$transaction(async (tx) => {
    if (wantsFrontpageTop) {
      // 1면톱은 사이트 전체 1건만 유지 — 새로 지정 전 기존 지정 해제
      await tx.article.updateMany({
        where: { isFrontpageTop: true },
        data: { isFrontpageTop: false },
      });
    }

    return tx.article.create({
      data: {
        title: title ?? '',
        subtitle1: subtitle1 || null,
        subtitle2: subtitle2 || null,
        subtitle3: subtitle3 || null,
        content: safeContent,
        excerpt,
        hoverText: hoverText || null,
        themeTags: Array.isArray(themeTags) && themeTags.length ? themeTags.join(',') : null,
        coverImageUrl,
        categoryId,
        authorId,
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        isFrontpageTop: wantsFrontpageTop,
        images: images?.length
          ? { create: images.map((img: { url: string; caption?: string }, i: number) => ({ ...img, order: i })) }
          : undefined,
        keywords: keywordIds?.length
          ? { connect: keywordIds.map((id: string) => ({ id })) }
          : undefined,
        // 관련기사 — 발행된 기사 중에서 작성자가 직접 선택 (기능정의서 8.2)
        relatedArticles: relatedArticleIds?.length
          ? { connect: relatedArticleIds.map((id: string) => ({ id })) }
          : undefined,
        poll: wantsPoll
          ? {
              create: {
                question: poll.question.trim(),
                options: { create: validPollOptions.map((text, i) => ({ text, order: i })) },
              },
            }
          : undefined,
      },
      include: { images: true, keywords: true, relatedArticles: true, poll: { include: { options: true } } },
    });
  });

  return NextResponse.json(article, { status: 201 });
}
