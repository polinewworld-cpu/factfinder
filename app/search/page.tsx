import { prisma } from '@/lib/prisma';
import Masonry from '@/components/Masonry';
import { CARD_ARTICLE_SELECT, toCardArticle } from '@/lib/publicFields';

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? '').trim();

  // 영문 대소문자 구분 없이(mode: insensitive), 카드용 필드만 (2026-10-09)
  const articles = q
    ? (await prisma.article.findMany({
        where: {
          status: 'PUBLISHED',
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } },
            { author: { name: { contains: q, mode: 'insensitive' } } },
            { author: { nickname: { contains: q, mode: 'insensitive' } } }, // 기자 표시 이름(닉네임)으로도 검색 (2026-10-08)
          ],
        },
        select: CARD_ARTICLE_SELECT,
        orderBy: { publishedAt: 'desc' },
        take: 60,
      })).map(toCardArticle)
    : [];

  return (
    <>
      <div className="content" style={{ paddingBottom: 0 }}>
        <h1 style={{ fontFamily: 'var(--title)', fontSize: 20, fontWeight: 700, margin: '4px 0 20px' }}>
          {q ? (
            <>
              &quot;<span style={{ color: 'var(--accent)' }}>{q}</span>&quot; 검색결과 ({articles.length})
            </>
          ) : (
            '검색어를 입력해주세요'
          )}
        </h1>
      </div>
      <Masonry top={null} articles={articles as any} />
      {q && articles.length === 0 && (
        <div className="content">
          <div className="empty-state">
            <p>검색 결과가 없습니다.</p>
          </div>
        </div>
      )}
    </>
  );
}
