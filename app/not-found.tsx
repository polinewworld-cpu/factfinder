import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { toFrenchBrackets } from '@/lib/frenchBrackets';

// 404 페이지 (2026-10-10 개편) — 옛 사이트 주소·지워진 기사로 들어온 방문자가 그냥 떠나지 않게 검색창과 최신 기사를 보여줌
export default async function NotFound() {
  const latest = await prisma.article
    .findMany({
      where: { status: 'PUBLISHED', showOnMain: true },
      orderBy: { publishedAt: 'desc' },
      take: 5,
      select: { id: true, title: true },
    })
    .catch(() => []);

  return (
    <main className="max-w-xl mx-auto px-4 py-16 sm:py-20 text-center">
      <p className="text-6xl font-extrabold tracking-tight" style={{ color: '#ff247d', fontFamily: 'var(--title)' }}>
        404
      </p>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 text-sm text-gray-500">주소가 잘못됐거나, 기사가 옮겨지거나 삭제됐을 수 있습니다. 찾으시는 기사를 검색해 보세요.</p>

      <form action="/search" className="mt-7 flex gap-2">
        <input
          name="q"
          placeholder="기사 제목이나 기자 이름"
          className="flex-1 min-w-0 rounded-full border border-gray-300 px-5 py-3 text-sm outline-none focus:border-brand"
        />
        <button type="submit" className="shrink-0 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white">
          검색
        </button>
      </form>

      {latest.length > 0 && (
        <div className="mt-10 text-left">
          <h2 className="text-sm font-bold text-gray-900 mb-2">최신 기사</h2>
          <ul className="divide-y divide-gray-100 border-y border-gray-100">
            {latest.map((a) => (
              <li key={a.id}>
                <Link href={`/article/${a.id}`} className="block py-3 text-sm text-gray-700 hover:text-brand">
                  {toFrenchBrackets(a.title).replace(/\s+/g, ' ')}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link href="/" className="mt-8 inline-block text-sm font-semibold text-gray-600 hover:text-brand">
        홈으로 가기 →
      </Link>
    </main>
  );
}
