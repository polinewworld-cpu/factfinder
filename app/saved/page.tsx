import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import Masonry from '@/components/Masonry';
import { CARD_ARTICLE_SELECT, toCardArticle } from '@/lib/publicFields';

// 내가 저장한 기사 목록 — 카테고리 줄 "저장한 기사"와 계정 메뉴에서 진입 (기능정의서 3.1)
export default async function SavedArticlesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="px-4 py-16 text-center">
        <p className="text-gray-600 mb-4">저장한 기사를 보려면 로그인이 필요합니다.</p>
        <a href="/login" className="text-brand font-semibold">
          로그인하러 가기 →
        </a>
      </main>
    );
  }

  const saved = await prisma.savedArticle.findMany({
    where: { userId: user.id, article: { status: 'PUBLISHED' } },
    orderBy: { createdAt: 'desc' },
    select: { article: { select: CARD_ARTICLE_SELECT } },
  });
  const articles = saved.map((s) => toCardArticle(s.article));

  return (
    <>
      <div className="content" style={{ paddingBottom: 0 }}>
        <div className="saved-head">
          <h1 className="saved-title">저장한 기사</h1>
          <span className="saved-count">전체 {articles.length.toLocaleString('ko-KR')}건</span>
        </div>
      </div>
      {articles.length === 0 ? (
        <div className="content">
          <div className="empty-state">
            <p>아직 저장한 기사가 없습니다. 기사 카드에 마우스를 올리면 나오는 책갈피 버튼으로 저장할 수 있어요.</p>
          </div>
        </div>
      ) : (
        <Masonry articles={articles as any} />
      )}
    </>
  );
}
