// 기사 본문 삽입 광고 — 관리자가 설정한 개수만큼, 정해진 위치에 노출 (기능정의서 5)
export default function ArticleBodyBanner({ imageUrl, linkUrl }: { imageUrl: string; linkUrl: string }) {
  return (
    <a
      href={linkUrl}
      target="_blank"
      rel="noopener noreferrer sponsored"
      style={{ display: 'block', margin: '20px 0' }}
    >
      <span style={{ display: 'block', fontSize: 11, color: 'var(--ash)', marginBottom: 4 }}>광고</span>
      <img src={imageUrl} alt="광고" style={{ width: '100%', borderRadius: 8 }} />
    </a>
  );
}
