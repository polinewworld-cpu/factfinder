import SnsLinks from './SnsLinks';
import { timeAgo } from '@/lib/time';
import { UserAvatar } from './InitialAvatar';
import { toFrenchBrackets } from '@/lib/frenchBrackets';

type ReporterCardAuthor = {
  name: string;
  email: string;
  image: string | null;
  snsLinks: { url: string }[];
};

type ArticleLink = { id: string; title: string; publishedAt: Date | string | null };

function ReporterArticleLink({ article }: { article: ArticleLink }) {
  return (
    <li>
      <span className="reporter-card-entry">
        <a href={`/article/${article.id}`}>{toFrenchBrackets(article.title).replace(/\s+/g, ' ')}</a>
        {article.publishedAt ? <span className="reporter-card-when">{timeAgo(article.publishedAt)}</span> : null}
      </span>
    </li>
  );
}

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
        <UserAvatar
          image={author.image}
          seed={author.email || author.name}
          name={author.name}
          className="reporter-card-avatar reporter-card-avatar--fallback"
        />
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
                  <ReporterArticleLink key={a.id} article={a} />
                ))}
              </ul>
            </div>
          )}
          {bestArticles.length > 0 && (
            <div className="reporter-card-column">
              <ul className="reporter-card-list">
                {bestArticles.map((a) => (
                  <ReporterArticleLink key={a.id} article={a} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
