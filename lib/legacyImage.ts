import { createHash } from 'crypto';

// 옛 사이트 사진 경로(/data/…) → 우리 저장소 파일명 (2026-10-08)
// 옛 사진 옮기기(/api/admin/legacy-images)와 옛 사진 주소 연결(/data/[...path])이 같은 규칙을 써야 함 — 바꾸지 말 것.
// 저장소 파일명은 영문·숫자만 안전 — 한글·공백이 섞인 옛 파일명은 원래 경로의 해시를 붙여 충돌 없이 변환
export function legacyImageFilename(path: string) {
  const rel = decodeURIComponent(path).replace(/^\/?data\//, '');
  const flat = rel.replace(/\//g, '-');
  const safe = flat.replace(/[^A-Za-z0-9._-]/g, '_');
  const ext = safe.match(/\.[A-Za-z0-9]{2,5}$/)?.[0] ?? '';
  const hash = createHash('sha1').update(rel).digest('hex').slice(0, 8);
  return `legacy-${safe === flat ? safe : `${safe.slice(0, safe.length - ext.length)}-${hash}${ext}`}`;
}
