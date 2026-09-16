import SnsLinks from './SnsLinks';

type ReporterCardAuthor = {
  name: string;
  email: string;
  image: string | null;
  snsLinks: { url: string }[];
};

type ArticleLink = { id: string; title: string };

// 기사 말미 "기자 프로필" 카드 — 프로필사진/이름/이메일/SNS 로고+링크 + 그 기자의 기사 2종(최신/BEST) (2026-09-12 신설)
// 기존엔 이 정보(SNS 로고 등)가 상단 byline에 있었으나, byline은 기자명만 남기고 여기로 옮김.
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
              <p className="reporter-card-column-title">{author.name} 기자가 쓴 최신기사</p>
              <ul className="reporter-card-list">
                {recentArticles.map((a) => (
                  <li key={a.id}>
                    <a href={`/article/${a.id}`}>{a.title}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {bestArticles.length > 0 && (
            <div className="reporter-card-column">
              <p className="reporter-card-column-title">{author.name} 기자의 BEST 기사</p>
              <ul className="reporter-card-list">
                {bestArticles.map((a) => (
                  <li key={a.id}>
                    <a href={`/article/${a.id}`}>{a.title}</a>
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
