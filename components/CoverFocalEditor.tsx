'use client';

import { cardImageRatio, coverObjectPosition } from '@/lib/cardImage';

export default function CoverFocalEditor({
  imageUrl,
  articleId,
  x,
  y,
  onChangeX,
  onChangeY,
}: {
  imageUrl: string;
  articleId?: string | null;
  x: number;
  y: number;
  onChangeX: (value: number) => void;
  onChangeY: (value: number) => void;
}) {
  const ratio = cardImageRatio(articleId);

  return (
    <div className="cover-focal">
      <div className="cover-focal-preview">
        <img
          src={imageUrl}
          alt=""
          style={{
            aspectRatio: `1 / ${ratio}`,
            objectPosition: coverObjectPosition(x, y),
          }}
        />
      </div>
      <div className="cover-focal-sliders">
        <p className="cover-focal-hint">카드에 보이는 사진 위치를 맞춥니다. 가로는 왼쪽–오른쪽, 세로는 위–아래입니다.</p>
        <label>
          <span>가로 {x}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={x}
            onChange={(e) => onChangeX(Number(e.target.value))}
          />
        </label>
        <label>
          <span>세로 {y}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={y}
            onChange={(e) => onChangeY(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
