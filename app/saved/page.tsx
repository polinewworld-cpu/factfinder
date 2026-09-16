import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import Masonry from '@/components/Masonry';

// 내가 저장한 기사 목록 — 우상단 계정 메뉴의 "저장한 기사"에서 진입 (기능정의서 3.1)
export default async function SavedArticlesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="px-4 py-16 text-center">
        <p className="text-gray-600 mb-4">저장한 기사를 보려면 로그인이 필요합니다.</p>
        <a href="/api/auth/signin" className="text-brand font-semibold">
          로그인하러 가기 →
        </a>
      </main>
    );
  }

  const saved = await prisma.savedArticle.findMany({
    where: { userId: user.id, article: { status: 'PUBLISHED' } },
    orderBy: { createdAt: 'desc' },
    include: { article: { include: { author: true, keywords: true, category: true } } },
  });
  const articles = saved.map((s) => s.article);

  return (
    <main className="px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">저장한 기사</h1>
        <span className="text-xs text-gray-400">전체 {articles.length.toLocaleString('ko-KR')}건</span>
      </div>
      {articles.length === 0 ? (
        <p className="text-gray-400 text-sm py-16 text-center">아직 저장한 기사가 없습니다. 기사 카드에 마우스를 올리면 나오는 책갈피 버튼으로 저장할 수 있어요.</p>
      ) : (
        <Masonry articles={articles as any} />
      )}
    </main>
  );
}
