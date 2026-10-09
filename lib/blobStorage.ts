import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';

// 저장 위치 우선순위: Supabase Storage(SUPABASE_SERVICE_ROLE_KEY 설정 시, Render 등 실제 배포 환경용)
// > 로컬 파일(없을 때만 — 순수 로컬 개발용 폴백). Netlify Blobs 경로는 2026-10-09 삭제(Render 이전 완료).
// Render는 재배포마다 디스크가 초기화되므로 로컬 파일 방식으로 두면 업로드한 파일이 사라짐 — 반드시 Supabase Storage를 써야 함.
const SUPABASE_BUCKET = 'uploads';
const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;
const LOCAL_DIR = path.join(process.cwd(), '.local-uploads');

async function ensureLocalDir() {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
}

function metaPath(filename: string) {
  return path.join(LOCAL_DIR, `${filename}.meta.json`);
}

export async function putBlob(filename: string, buffer: Buffer, contentType: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(filename, buffer, { contentType, upsert: true });
    if (error) throw error;
    return;
  }
  await ensureLocalDir();
  await fs.writeFile(path.join(LOCAL_DIR, filename), buffer);
  await fs.writeFile(metaPath(filename), JSON.stringify({ contentType }));
}

export async function getBlob(filename: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  if (supabase) {
    const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download(filename);
    if (error || !data) return null;
    const contentType = data.type || 'application/octet-stream';
    return { data: await data.arrayBuffer(), contentType };
  }
  try {
    const buf = await fs.readFile(path.join(LOCAL_DIR, filename));
    let contentType = 'application/octet-stream';
    try {
      const meta = JSON.parse(await fs.readFile(metaPath(filename), 'utf-8'));
      contentType = meta.contentType ?? contentType;
    } catch {
      /* 메타 파일이 없으면 기본 content-type 사용 */
    }
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    return { data: arrayBuffer, contentType };
  } catch {
    return null;
  }
}

// 파일 지우기 (2026-10-09, 유령기자 신분증 사진 삭제용) — Supabase만 지원, 그 외는 조용히 넘어감
// 같은 이름 파일이 이미 있는지 (읽어주기 음성 재사용 등, 2026-10-09)
export async function blobExists(filename: string): Promise<boolean> {
  if (supabase) {
    const { data } = await supabase.storage.from(SUPABASE_BUCKET).list('', { search: filename, limit: 1 });
    return !!data?.some((f) => f.name === filename);
  }
  return fs.access(path.join(LOCAL_DIR, filename)).then(() => true, () => false);
}

// 기사의 읽어주기 음성 파일(tts-<기사id>-…) 전부 삭제 — 본문 수정·기사 삭제 때 (2026-10-09)
export async function deleteArticleAudio(articleId: string): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.storage.from(SUPABASE_BUCKET).list('', { search: `tts-${articleId}-`, limit: 100 });
  const names = (data ?? []).map((f) => f.name).filter((n) => n.startsWith(`tts-${articleId}-`));
  if (names.length) await supabase.storage.from(SUPABASE_BUCKET).remove(names);
}

export async function deleteBlob(filename: string): Promise<void> {
  if (supabase) {
    await supabase.storage.from(SUPABASE_BUCKET).remove([filename]);
    return;
  }
  await fs.unlink(path.join(LOCAL_DIR, filename)).catch(() => {});
}
