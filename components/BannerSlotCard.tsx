'use client';

// 메인화면 그리드의 광고 슬롯(3/5/7번째 카드 자리) 카드 (기능정의서 5)
export default function BannerSlotCard({ imageUrl, linkUrl }: { imageUrl: string; linkUrl: string }) {
  return (
    <article className="pin">
      <a className="pin-media" href={linkUrl} target="_blank" rel="noopener noreferrer sponsored">
        <img src={imageUrl} alt="광고" style={{ aspectRatio: '1 / 0.9' }} />
        <div className="pin-overlay">
          <span className="ghost-chip">광고</span>
        </div>
      </a>
    </article>
  );
}
