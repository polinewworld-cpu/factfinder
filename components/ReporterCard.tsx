import SnsLinks from './SnsLinks';
import { timeAgo } from '@/lib/time';

type ReporterCardAuthor = {
  name: string;
  email: string;
  image: string | null;
  snsLinks: { url: string }[];
};

type ArticleLink = { id: string; title: string; publishedAt: Date | string | null };

// 기사 말미 기자 프로필 — 최신 3건 / BEST 3건. 제목 옆에 발행 경과 시간 (2026-09-12 신설)
export default function ReporterCard({
  author,
  recentArticles,
  bestArticles,
}: {
  author: ReporterCardAuthor;
  recentArticles: ArticleLink[];
  bestArticles: ArticleLink[];
}) {
  return (
    <div className="reporter-card">
      <div className="reporter-card-head">
        {author.image ? (
          <img src={author.image} alt="" className="reporter-card-avatar" />
        ) : (
          <div className="reporter-card-avatar reporter-card-avatar--fallback" aria-hidden="true">
            {author.name.slice(0, 1)}
          </div>
        )}
        <div className="reporter-card-info">
          <p className="reporter-card-name">{author.name} 기자</p>
          <p className="reporter-card-email">{author.email}</p>
        </div>
        <SnsLinks links={author.snsLinks} />
      </div>
      {(recentArticles.length > 0 || bestArticles.length > 0) && (
        <div className="reporter-card-columns">
          {recentArticles.length > 0 && (
            <div className="reporter-card-column">
              <ul className="reporter-card-list">
                {recentArticles.map((a) => (
                  <li key={a.id}>
                    <a href={`/article/${a.id}`}>{a.title}</a>
                    {a.publishedAt ? <span className="reporter-card-when"> {timeAgo(a.publishedAt)}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {bestArticles.length > 0 && (
            <div className="reporter-card-column">
              <ul className="reporter-card-list">
                {bestArticles.map((a) => (
                  <li key={a.id}>
                    <a href={`/article/${a.id}`}>{a.title}</a>
                    {a.publishedAt ? <span className="reporter-card-when"> {timeAgo(a.publishedAt)}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
