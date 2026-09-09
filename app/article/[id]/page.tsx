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
import { stripHtml } from '@/lib/stripHtml';

export default async function ArticlePage({ params }: { params: { id: string } }) {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: { author: true, category: true, keywords: true, images: true, poll: true },
  });

  if (!article || article.status !== 'PUBLISHED') notFound();

  // 조회수 증가 (데모 단순화를 위해 상세 페이지 렌더링 시 직접 처리)
  await prisma.article.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } });

  const kicker = article.keywords.length > 0
    ? article.keywords.map((k) => k.name).join(' · ')
    : article.category?.name ?? '팩트파인더';

  return (
    <div className="article-layout">
      <article className="article-main">
        {article.coverImageUrl && (
          <img className="article-hero" src={article.coverImageUrl} alt="" />
        )}
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
          <div className="article-byline">
            <span>
              {article.author.name} 기자 · 조회 {article.viewCount + 1}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ReadAloudButton text={`${article.title}. ${stripHtml(article.content)}`} gender={article.author.gender} />
              <ShareButtons title={article.title} coverImageUrl={article.coverImageUrl} />
            </span>
          </div>
          <div className="article-content" dangerouslySetInnerHTML={{ __html: article.content }} />
          <CardNewsCarousel articleId={article.id} images={article.images} />
          {article.poll && <PollCard pollId={article.poll.id} />}
          <EmbedScripts />
          <CommentSection articleId={article.id} />
        </div>
      </article>
      <RelatedArticles articleId={article.id} keywordNames={article.keywords.map((k) => k.name)} />
    </div>
  );
}
