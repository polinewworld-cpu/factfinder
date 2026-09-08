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

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
      <article className="flex-1 min-w-0">
        <p className="text-brand text-sm font-bold mb-2">{article.category?.name ?? '미지정'}</p>
        {article.keywords.length > 0 && (
          <div className="mb-3">
            {article.keywords.map((k) => (
              <a key={k.name} href={`/keyword/${encodeURIComponent(k.name)}`} className="keyword-badge">
                {k.name}
              </a>
            ))}
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-3">{article.title}</h1>
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-gray-400">
            {article.author.name} · {article.publishedAt ? timeAgo(article.publishedAt) : ''} · 조회 {article.viewCount + 1}
          </div>
          <div className="flex items-center gap-2">
            <ReadAloudButton text={`${article.title}. ${stripHtml(article.content)}`} gender={article.author.gender} />
            <ShareButtons title={article.title} coverImageUrl={article.coverImageUrl} />
          </div>
        </div>
        {article.coverImageUrl && (
          <img src={article.coverImageUrl} alt="" className="w-full rounded-xl mb-6" />
        )}
        <div
          className="prose max-w-none leading-relaxed text-gray-900"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
        <CardNewsCarousel articleId={article.id} images={article.images} />
        {article.poll && <PollCard pollId={article.poll.id} />}
        <EmbedScripts />
        <CommentSection articleId={article.id} />
      </article>
      <RelatedArticles articleId={article.id} keywordNames={article.keywords.map((k) => k.name)} />
    </main>
  );
}
