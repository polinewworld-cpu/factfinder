import { prisma } from '@/lib/prisma';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { timeAgo } from '@/lib/time';
import RelatedArticles from '@/components/RelatedArticles';
import CommentSection from '@/components/CommentSection';
import ShareButtons from '@/components/ShareButtons';
import EmbedScripts from '@/components/EmbedScripts';
import CardNewsCarousel from '@/components/CardNewsCarousel';
import ReadAloudButton from '@/components/ReadAloudButton';
import PollCard from '@/components/PollCard';
import SaveButton from '@/components/SaveButton';
import ArticleBodyBanner from '@/components/ArticleBodyBanner';
import ReporterCard from '@/components/ReporterCard';
import TextSizeControl from '@/components/TextSizeControl';
import RecommendButton from '@/components/RecommendButton';
import DonateButtonLarge from '@/components/DonateButtonLarge';
import { stripHtml } from '@/lib/stripHtml';
import { toFrenchBrackets } from '@/lib/frenchBrackets';
import { stripYoutubeComposerControls } from '@/lib/sanitizeArticle';
import { getCurrentUser } from '@/lib/session';
import { EditIcon, ThinArrowIcon } from '@/components/icons';
import { ROLES } from '@/lib/roles';
import ArticleHeadline from '@/components/ArticleHeadline';
import { enhanceArticleImages } from '@/lib/articleHtml';
import { authorName, bylineOf, isLegacyEmail } from '@/lib/byline';
import { SITE_URL } from '@/lib/siteTags';

// 옛 사이트(다다미디어 CMS) 기사 번호는 숫자 — /article/3377 같은 옛 주소 판별용 (2026-10-08)
const isLegacyId = (id: string) => /^\d{1,9}$/.test(id);

// 카톡·페북·X 공유 미리보기 + 검색엔진용 기사별 메타 태그 (2026-10-08 신설)
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  if (isLegacyId(params.id)) return {};
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    select: {
      title: true, subtitle1: true, excerpt: true, content: true, coverImageUrl: true,
      status: true, publishedAt: true, updatedAt: true, author: { select: { nickname: true, name: true } },
    },
  });
  if (!article || article.status !== 'PUBLISHED') return {};
  const description = (article.subtitle1 || article.excerpt || stripHtml(article.content)).trim().slice(0, 160);
  const image = article.coverImageUrl || article.content.match(/<img[^>]+src="([^"]+)"/i)?.[1];
  const url = `/article/${params.id}`;
  return {
    title: `${article.title} - 팩트파인더`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      siteName: '팩트파인더',
      locale: 'ko_KR',
      url,
      title: article.title,
      description,
      images: image ? [image] : undefined,
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      authors: [authorName(article.author)],
    },
    twitter: { card: 'summary_large_image', title: article.title, description, images: image ? [image] : undefined },
  };
}

export default async function ArticlePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { popup?: string };
}) {
  // 옛 기사 번호로 들어오면 이관된 새 기사 주소로 영구 이동(301 계열) — 검색엔진 순위·공유 링크 보존
  if (isLegacyId(params.id)) {
    const migrated = await prisma.article.findUnique({ where: { legacyId: Number(params.id) }, select: { id: true } });
    if (!migrated) notFound();
    permanentRedirect(`/article/${migrated.id}`);
  }

  const [article, currentUser, siteConfig, articleBanners, lineAds] = await Promise.all([
    prisma.article.findUnique({
      where: { id: params.id },
      include: {
        author: { include: { snsLinks: { orderBy: { order: 'asc' } } } },
        category: true,
        keywords: true,
        images: true,
        poll: true,
        relatedArticles: { include: { author: true } },
      },
    }),
    getCurrentUser(),
    prisma.siteConfig.findUnique({ where: { id: 'singleton' } }),
    prisma.banner.findMany({ where: { placement: 'ARTICLE_BODY', active: true }, orderBy: { order: 'asc' } }),
    // 기사 본문 맨 마지막에 노출되는 줄광고 — 활성 상태만 순서대로 최대 10개 (2026-09-12 신설)
    prisma.lineAd.findMany({ where: { active: true }, orderBy: { order: 'asc' }, take: 10 }),
  ]);

  if (!article || article.status !== 'PUBLISHED') notFound();

  // 기사 말미 기자 프로필 — 같은 기자가 쓴 다른 발행 기사 중 최신 3건 + BEST 3건 (1년 누적 조회수)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const [recentByAuthor, bestByAuthor] = await Promise.all([
    prisma.article.findMany({
      where: { authorId: article.authorId, status: 'PUBLISHED', NOT: { id: article.id } },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      select: { id: true, title: true, publishedAt: true },
    }),
    prisma.article.findMany({
      where: {
        authorId: article.authorId,
        status: 'PUBLISHED',
        NOT: { id: article.id },
        publishedAt: { gte: oneYearAgo },
      },
      orderBy: { viewCount: 'desc' },
      take: 3,
      select: { id: true, title: true, publishedAt: true },
    }),
  ]);

  const alreadySaved = currentUser
    ? !!(await prisma.savedArticle.findUnique({
        where: { userId_articleId: { userId: currentUser.id, articleId: article.id } },
      }))
    : false;

  const canEdit =
    !!currentUser &&
    (currentUser.role === ROLES.CHIEF_EDITOR || currentUser.id === article.authorId);

  // 조회수 증가 (데모 단순화를 위해 상세 페이지 렌더링 시 직접 처리)
  // updatedAt은 @updatedAt이라 update() 호출만으로 자동 갱신됨 — 조회는 "수정"이 아니므로 기존 값을
  // 그대로 돌려줘서 관리자 "최종편집일"이 조회수만 올라도 오늘로 밀리던 문제를 막음 (2026-09-22)
  await prisma.article.update({
    where: { id: article.id },
    data: { viewCount: { increment: 1 }, updatedAt: article.updatedAt },
  });

  const subtitles = [article.subtitle1, article.subtitle2, article.subtitle3]
    .filter(Boolean)
    .map((s) => toFrenchBrackets(s as string));
  const title = toFrenchBrackets(article.title);
  const content = enhanceArticleImages(toFrenchBrackets(stripYoutubeComposerControls(article.content)), title);
  const activeArticleBanners = articleBanners.slice(0, siteConfig?.articleBannerCount ?? 0);

  // 구글 등 검색엔진용 "뉴스 기사" 구조화 데이터(NewsArticle) — 날짜·기자·사진을 검색 결과에 표시 (2026-10-08 SEO)
  const abs = (u: string) => new URL(u, SITE_URL).toString();
  const firstImage = article.coverImageUrl || article.content.match(/<img[^>]+src="([^"]+)"/i)?.[1];
  const newsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: title.slice(0, 110),
    description: (subtitles[0] || article.excerpt || '').slice(0, 200) || undefined,
    image: firstImage ? [abs(firstImage)] : [abs('/og-default.png')],
    datePublished: (article.publishedAt ?? article.createdAt).toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: [{ '@type': 'Person', name: authorName(article.author) }],
    publisher: { '@type': 'Organization', name: '팩트파인더', logo: { '@type': 'ImageObject', url: abs('/og-default.png') } },
    mainEntityOfPage: abs(`/article/${article.id}`),
    articleSection: article.category?.name,
    keywords: article.keywords.map((k) => k.name).join(', ') || undefined,
  };

  // ?popup=1 — 관리자 대시보드에서 띄우는 기사 전용 창: 사이트 머리·메뉴·바닥글을 숨기고 기사만 (2026-10-08)
  const popup = searchParams?.popup === '1';

  return (
    <div className="article-layout">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(newsJsonLd).replace(/</g, '\\u003c') }} />
      {popup && <style>{'.site-header,.category-bar,.site-footer,.article-rail{display:none!important}.article-layout{display:block!important;max-width:760px;margin:0 auto}'}</style>}
      <article className="article-main">
        {/* 기사 상단 1면 이미지 노출 제거 — coverImageUrl은 이제 본문(article-figure)에서만 보이면 되므로
            여기서는 렌더링하지 않음 (다른 곳: 메인 카드 썸네일, 공유 미리보기, 관련기사 카드 등은 계속 사용) (2026-09-12) */}
        <div className="article-body">
          <p className="article-kicker">
            {article.keywords.length > 0 ? (
              article.keywords.map((k, i) => (
                <span key={k.name}>
                  {i > 0 ? ' · ' : ''}
                  <a href={`/keyword/${encodeURIComponent(k.name)}`}>{k.name}</a>
                </span>
              ))
            ) : (
              article.category?.name ?? '팩트파인더'
            )}
            {article.publishedAt ? ` · ${timeAgo(article.publishedAt)}` : ''}
          </p>
          <ArticleHeadline articleId={article.id} title={title} canEdit={canEdit} />
          {subtitles.length > 0 && (
            <div className="article-subtitles">
              {subtitles.map((s, i) => (
                <p key={i}>{s}</p>
              ))}
            </div>
          )}
          <div className="article-byline">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {bylineOf(article.author)}
            </span>
            <span className="icon-action-group">
              {canEdit && (
                <a
                  href={`/write?id=${article.id}`}
                  className="icon-action"
                  title="기사 수정"
                  aria-label="기사 수정"
                >
                  <EditIcon />
                </a>
              )}
              <ShareButtons title={title.replace(/\s+/g, ' ').trim()} coverImageUrl={article.coverImageUrl} />
              <SaveButton articleId={article.id} initialSaved={alreadySaved} loggedIn={!!currentUser} />
              <TextSizeControl />
              <ReadAloudButton
                articleId={article.id}
                text={`${title.replace(/\s+/g, ' ').trim()}. ${stripHtml(content)}`}
              />
            </span>
          </div>
          <div className="article-content" dangerouslySetInnerHTML={{ __html: content }} />
          <div className="donate-cta-row">
            <div className="donate-cta-row-item" style={{ flex: 1 }}>
              <RecommendButton articleId={article.id} initialCount={article.recommendCount} variant="large" />
            </div>
            <div className="donate-cta-row-item" style={{ flex: 1 }}>
              <ShareButtons title={title.replace(/\s+/g, ' ').trim()} coverImageUrl={article.coverImageUrl} variant="large" />
            </div>
            <div className="donate-cta-row-item" style={{ flex: 2 }}>
              <DonateButtonLarge reporterId={article.authorId} articleId={article.id} />
            </div>
          </div>
          {activeArticleBanners[0] && (
            <ArticleBodyBanner imageUrl={activeArticleBanners[0].imageUrl} linkUrl={activeArticleBanners[0].linkUrl} />
          )}
          <CardNewsCarousel articleId={article.id} images={article.images} />
          {article.poll && <PollCard pollId={article.poll.id} />}
          {activeArticleBanners[1] && (
            <ArticleBodyBanner imageUrl={activeArticleBanners[1].imageUrl} linkUrl={activeArticleBanners[1].linkUrl} />
          )}
          <EmbedScripts />
          {lineAds.length > 0 && (
            <ul className="line-ads">
              {lineAds.map((ad) => (
                <li key={ad.id} className="line-ad">
                  <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer sponsored" className="line-ad-link">
                    <span className="line-ad-arrow">
                      <ThinArrowIcon />
                    </span>
                    <span className="line-ad-text">{toFrenchBrackets(ad.text)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <ReporterCard
            author={{
              name: authorName(article.author),
              byline: bylineOf(article.author),
              email: isLegacyEmail(article.author.email) ? '' : article.author.email,
              image: article.author.image,
              snsLinks: article.author.snsLinks,
            }}
            recentArticles={recentByAuthor}
            bestArticles={bestByAuthor}
          />
          <CommentSection articleId={article.id} />
          {activeArticleBanners[2] && (
            <ArticleBodyBanner imageUrl={activeArticleBanners[2].imageUrl} linkUrl={activeArticleBanners[2].linkUrl} />
          )}
        </div>
      </article>
      <RelatedArticles
        articleId={article.id}
        keywordNames={article.keywords.map((k) => k.name)}
        manualRelated={article.relatedArticles.map((a) => ({
          id: a.id,
          title: toFrenchBrackets(a.title),
          author: { name: authorName(a.author) },
          publishedAt: a.publishedAt as unknown as string,
          coverImageUrl: a.coverImageUrl,
          coverFocalX: a.coverFocalX,
          coverFocalY: a.coverFocalY,
        }))}
      />
    </div>
  );
}
