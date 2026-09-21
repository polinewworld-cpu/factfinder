import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
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
import { CommentIcon } from '@/components/icons';
import { stripHtml } from '@/lib/stripHtml';
import { getCurrentUser } from '@/lib/session';

export default async function ArticlePage({ params }: { params: { id: string } }) {
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
        _count: { select: { comments: true } },
      },
    }),
    getCurrentUser(),
    prisma.siteConfig.findUnique({ where: { id: 'singleton' } }),
    prisma.banner.findMany({ where: { placement: 'ARTICLE_BODY', active: true }, orderBy: { order: 'asc' } }),
    // 기사 본문 맨 마지막에 노출되는 줄광고 — 활성 상태만 순서대로 최대 10개 (2026-09-12 신설)
    prisma.lineAd.findMany({ where: { active: true }, orderBy: { order: 'asc' }, take: 10 }),
  ]);

  if (!article || article.status !== 'PUBLISHED') notFound();

  // 기사 말미 "기자 프로필" 카드용 — 같은 기자가 쓴 다른 발행 기사 중 최신 5건 + BEST 5건(1년 누적 조회수 기준) (2026-09-12 신설)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const [recentByAuthor, bestByAuthor] = await Promise.all([
    prisma.article.findMany({
      where: { authorId: article.authorId, status: 'PUBLISHED', NOT: { id: article.id } },
      orderBy: { publishedAt: 'desc' },
      take: 5,
      select: { id: true, title: true },
    }),
    prisma.article.findMany({
      where: {
        authorId: article.authorId,
        status: 'PUBLISHED',
        NOT: { id: article.id },
        publishedAt: { gte: oneYearAgo },
      },
      orderBy: { viewCount: 'desc' },
      take: 5,
      select: { id: true, title: true },
    }),
  ]);

  const alreadySaved = currentUser
    ? !!(await prisma.savedArticle.findUnique({
        where: { userId_articleId: { userId: currentUser.id, articleId: article.id } },
      }))
    : false;

  // 조회수 증가 (데모 단순화를 위해 상세 페이지 렌더링 시 직접 처리)
  await prisma.article.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } });

  const subtitles = [article.subtitle1, article.subtitle2, article.subtitle3].filter(Boolean) as string[];
  const activeArticleBanners = articleBanners.slice(0, siteConfig?.articleBannerCount ?? 0);

  const kicker = article.keywords.length > 0
    ? article.keywords.map((k) => k.name).join(' · ')
    : article.category?.name ?? '팩트파인더';

  return (
    <div className="article-layout">
      <article className="article-main">
        {/* 기사 상단 1면 이미지 노출 제거 — coverImageUrl은 이제 본문(article-figure)에서만 보이면 되므로
            여기서는 렌더링하지 않음 (다른 곳: 메인 카드 썸네일, 공유 미리보기, 관련기사 카드 등은 계속 사용) (2026-09-12) */}
        <div className="article-body">
          <p className="article-kicker">
            {kicker} · {article.publishedAt ? timeAgo(article.publishedAt) : ''}
          </p>
          {article.keywords.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {article.keywords.map((k) => (
                <a key={k.name} href={`/keyword/${encodeURIComponent(k.name)}`} className="keyword-badge">
                  {k.name}
                </a>
              ))}
            </div>
          )}
          <h1>{article.title}</h1>
          {subtitles.length > 0 && (
            <div className="article-subtitles">
              {subtitles.map((s, i) => (
                <p key={i}>{s}</p>
              ))}
            </div>
          )}
          <div className="article-byline">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {article.author.name} 기자
            </span>
            <span className="icon-action-group">
              <SaveButton articleId={article.id} initialSaved={alreadySaved} loggedIn={!!currentUser} />
              <TextSizeControl />
              <ReadAloudButton
                articleId={article.id}
                text={`${article.title}. ${stripHtml(article.content)}`}
                gender={article.author.gender}
              />
              <a href="#comments" className="icon-action">
                <CommentIcon />
                {article._count.comments}
              </a>
            </span>
          </div>
          <div className="article-content" dangerouslySetInnerHTML={{ __html: article.content }} />
          <div className="donate-cta-row">
            <div className="donate-cta-row-item" style={{ flex: 1 }}>
              <RecommendButton articleId={article.id} initialCount={article.recommendCount} variant="large" />
            </div>
            <div className="donate-cta-row-item" style={{ flex: 1 }}>
              <ShareButtons title={article.title} coverImageUrl={article.coverImageUrl} variant="large" />
            </div>
            <div className="donate-cta-row-item" style={{ flex: 2 }}>
              <DonateButtonLarge reporterId={article.authorId} />
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
                    <span className="line-ad-arrow">➜</span>
                    <span className="line-ad-text">{ad.text}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <ReporterCard
            author={{
              name: article.author.name,
              email: article.author.email,
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
          title: a.title,
          author: { name: a.author.name },
          publishedAt: a.publishedAt as unknown as string,
          coverImageUrl: a.coverImageUrl,
        }))}
      />
    </div>
  );
}
