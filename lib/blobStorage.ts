import { getStore } from '@netlify/blobs';
import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';

// 저장 위치 우선순위: Supabase Storage(SUPABASE_SERVICE_ROLE_KEY 설정 시, Render 등 실제 배포 환경용)
// > Netlify Blobs(예전 Netlify 배포용, 이제 미사용이지만 코드는 남겨둠)
// > 로컬 파일(둘 다 없을 때만 — 순수 로컬 개발용 폴백).
// Render는 재배포마다 디스크가 초기화되므로 로컬 파일 방식으로 두면 업로드한 파일이 사라짐 — 반드시 Supabase Storage를 써야 함.
const isNetlify = !!process.env.NETLIFY;
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
  if (isNetlify) {
    const store = getStore('uploads');
    await store.set(filename, buffer, { metadata: { contentType } });
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
  if (isNetlify) {
    const store = getStore('uploads');
    const result = await store.getWithMetadata(filename, { type: 'arrayBuffer' });
    if (!result) return null;
    const contentType =
      (result.metadata as { contentType?: string } | undefined)?.contentType ?? 'application/octet-stream';
    return { data: result.data, contentType };
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
