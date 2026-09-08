import { timeAgo } from '@/lib/time';

type CardArticle = {
  id: string;
  title: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  publishedAt?: string | Date | null;
  author: { name: string };
  keywords: { name: string }[];
  isFrontpageTop?: boolean;
};

export default function ArticleCard({ article, big = false }: { article: CardArticle; big?: boolean }) {
  return (
    <a
      href={`/article/${article.id}`}
      className={`block break-inside-avoid mb-4 bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:border-brand/50 hover:shadow-md transition ${
        big ? 'row-span-2' : ''
      }`}
    >
      <div
        className={`w-full bg-gray-100 ${big ? 'aspect-[4/3]' : 'aspect-[16/10]'} flex items-center justify-center text-gray-400 text-xs`}
        style={
          article.coverImageUrl
            ? { backgroundImage: `url(${article.coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      >
        {!article.coverImageUrl && '이미지 없음'}
      </div>
      <div className="p-4">
        {article.keywords.length > 0 && (
          <div className="mb-1">
            {article.keywords.map((k) => (
              <span key={k.name} className="keyword-badge">
                {k.name}
              </span>
            ))}
          </div>
        )}
        <h3 className={`font-bold leading-snug text-gray-900 ${big ? 'text-xl' : 'text-base'}`}>{article.title}</h3>
        {big && article.excerpt && <p className="text-gray-500 text-sm mt-2 line-clamp-2">{article.excerpt}</p>}
        <div className="text-xs text-gray-400 mt-2">
          {article.author.name} · {article.publishedAt ? timeAgo(article.publishedAt) : ''}
        </div>
      </div>
    </a>
  );
}
