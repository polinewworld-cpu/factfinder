// 브라우저에서 이미지를 서버(/api/upload)로 보내기 전에 용량 제한(기본 10MB) 이내로 자동 압축하는 유틸.
// 서버 쪽엔 sharp 같은 이미지 처리 라이브러리가 설치돼 있지 않고, 이 세션은 사용자 PC에 npm install을
// 직접 실행할 방법이 없어서(인수인계서 참고) 순수 브라우저 Canvas API로 처리함 (2026-09-11 신설).
// 이미 제한 이내면 원본 그대로 반환하고, 아니면 (1) 품질을 낮추고 → (2) 그래도 안 되면 가로세로를
// 단계적으로 줄이는 순서로 재시도. PNG/GIF처럼 캔버스 toBlob에서 quality가 의미 없는 무손실 포맷은
// JPEG로 변환해서 압축함(투명 배경은 흰 배경으로 채워짐).
export async function compressImageFile(file: File, maxBytes = 10 * 1024 * 1024): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= maxBytes) return file;
  if (typeof document === 'undefined') return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // 디코딩 실패 시 원본 그대로 보냄 — 서버 10MB 체크에서 다시 막힐 수 있음
  }

  let width = bitmap.width;
  let height = bitmap.height;
  const outType = file.type === 'image/jpeg' || file.type === 'image/webp' ? file.type : 'image/jpeg';
  const outExt = outType === 'image/webp' ? 'webp' : 'jpg';

  let quality = 0.92;
  let blob: Blob | null = null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext('2d');
    if (!ctx) break;
    if (outType === 'image/jpeg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    // eslint-disable-next-line no-await-in-loop
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outType, quality));
    if (!blob) break;
    if (blob.size <= maxBytes) break;

    if (quality > 0.5) {
      quality = Math.max(0.5, quality - 0.12);
    } else {
      width *= 0.85;
      height *= 0.85;
      quality = 0.8; // 크기를 줄인 다음엔 품질을 조금 회복해서 다시 시도
    }
  }

  bitmap.close();
  if (!blob || blob.size > maxBytes) return file; // 그래도 못 줄이면 원본 그대로(서버가 다시 막아줌)

  const newName = file.name.replace(/\.[^.]+$/, '') + '.' + outExt;
  return new File([blob], newName, { type: outType });
}
