// Google Cloud Text-to-Speech(구글 클라우드 음성합성) 연동 — 기사 "읽어주기" 기능용 (2026-09-12 신설)
//
// 기존 브라우저 내장 음성합성(Web Speech API)은 방문자의 OS/브라우저가 제공하는 음성 품질에 그대로 좌우돼서
// 사람 목소리와 거리가 먼 경우가 많았음. 이 모듈은 서버에서 구글의 신경망 음성으로 미리 오디오 파일을
// 만들어두고(기사당 1회, Article.audioUrl에 캐싱) 그걸 재생하는 방식이라 훨씬 자연스럽게 들림.
//
// 음성 등급을 3단계로 두고 위에서부터 순서대로 시도함:
//   1순위 Chirp3-HD — 구글 최신 세대 음성, 사람 목소리와 가장 가까움(체감상 가장 자연스러움).
//                     단, 일부 API 키/프로젝트 설정에 따라 권한 오류(403 등)가 날 수 있음.
//   2순위 Neural2   — Chirp3-HD가 막혀 있을 때 대체. 이것도 충분히 자연스러운 신경망 음성.
//   3순위 Standard  — 오래되고 가장 기계음에 가깝지만, API 키만 있으면 거의 항상 호출 가능한 최후 보루.
// 위 단계에서 실패하면 자동으로 다음 단계로 넘어가므로, 사용자의 구글 클라우드 프로젝트 설정에 따라
// 자동으로 그 프로젝트에서 쓸 수 있는 가장 좋은 품질이 선택됨.
//
// ⚠️ 이 파일이 동작하려면 .env(.env.local 등)에 GOOGLE_TTS_API_KEY가 설정되어 있어야 함
//    (구글 클라우드 콘솔 → API 및 서비스 → 사용자 인증 정보에서 "Cloud Text-to-Speech API"를 사용하도록 제한한 API 키 발급).
//    키가 없으면 이 함수는 에러를 던지고, 호출부(app/api/articles/[id]/audio/route.ts)에서 이를 잡아
//    프런트가 예전 방식(브라우저 내장 음성합성)으로 자동 대체되도록 함.

const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

// Google TTS는 요청 1건당 입력 텍스트가 5,000바이트(UTF-8)를 넘을 수 없음.
// 한글은 글자당 3바이트라 넉넉히 여유를 두고 3,500바이트(≈한글 1,100자 안팎)로 자름.
const MAX_BYTES_PER_REQUEST = 3500;

type Tier = { label: string; voices: { FEMALE: string; MALE: string } };

const VOICE_TIERS: Tier[] = [
  { label: 'Chirp3-HD', voices: { FEMALE: 'ko-KR-Chirp3-HD-Kore', MALE: 'ko-KR-Chirp3-HD-Charon' } },
  { label: 'Neural2', voices: { FEMALE: 'ko-KR-Neural2-A', MALE: 'ko-KR-Neural2-C' } },
  { label: 'Standard', voices: { FEMALE: 'ko-KR-Standard-A', MALE: 'ko-KR-Standard-C' } },
];

function byteLength(s: string) {
  return Buffer.byteLength(s, 'utf-8');
}

// 문장부호 기준으로 최대한 자연스러운 위치에서 잘라 청크로 나눔 (문장 중간에서 끊기지 않도록).
function splitIntoChunks(text: string, maxBytes: number): string[] {
  const sentences = text.split(/(?<=[.!?。!?\n])\s*/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? current + sentence : sentence;
    if (byteLength(candidate) > maxBytes && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current);

  // 문장 하나 자체가 maxBytes를 넘는 극단적인 경우(문장부호 없는 긴 텍스트 등)를 대비한 강제 분할
  return chunks.flatMap((chunk) => (byteLength(chunk) <= maxBytes ? [chunk] : forceSplitByBytes(chunk, maxBytes)));
}

function forceSplitByBytes(text: string, maxBytes: number): string[] {
  const out: string[] = [];
  let buf = '';
  for (const ch of text) {
    if (byteLength(buf + ch) > maxBytes && buf) {
      out.push(buf);
      buf = ch;
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}

async function synthesizeChunk(apiKey: string, text: string, voiceName: string): Promise<Buffer> {
  const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'ko-KR', name: voiceName },
      audioConfig: { audioEncoding: 'MP3' },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`[${voiceName}] Google TTS 호출 실패 (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as { audioContent?: string };
  if (!data.audioContent) throw new Error(`[${voiceName}] Google TTS 응답에 audioContent가 없음`);
  return Buffer.from(data.audioContent, 'base64');
}

// text를 청크로 나눠 지정된 voiceName으로 순서대로 합성한 뒤 하나로 이어붙임.
// 구글 TTS의 MP3 출력은 별도 메타데이터 헤더가 없는 순수 MPEG 프레임이라, 여러 조각을 이어붙여도(binary concat)
// 대부분의 브라우저/플레이어에서 끊김 없이 재생됨(경계에서 아주 미세한 틱 소리가 날 수는 있음).
async function synthesizeWithVoice(apiKey: string, text: string, voiceName: string): Promise<Buffer> {
  const chunks = splitIntoChunks(text, MAX_BYTES_PER_REQUEST);
  if (chunks.length === 0) throw new Error('읽어줄 텍스트가 없습니다');
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    buffers.push(await synthesizeChunk(apiKey, chunk, voiceName));
  }
  return Buffer.concat(buffers);
}

// gender: User.gender 값('MALE' | 'FEMALE' | 그 외/null) — 그 외/null이면 여성 음성을 기본값으로 사용.
export async function synthesizeKoreanSpeech(text: string, gender?: string | null): Promise<{ buffer: Buffer; tierUsed: string }> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_TTS_API_KEY 환경변수가 설정되어 있지 않습니다');

  const key: 'FEMALE' | 'MALE' = gender === 'MALE' ? 'MALE' : 'FEMALE';
  const cleanText = text.trim();
  if (!cleanText) throw new Error('읽어줄 텍스트가 없습니다');

  let lastError: unknown;
  for (const tier of VOICE_TIERS) {
    try {
      const buffer = await synthesizeWithVoice(apiKey, cleanText, tier.voices[key]);
      return { buffer, tierUsed: tier.label };
    } catch (err) {
      lastError = err;
      console.error(`[TTS] ${tier.label} 등급 실패, 다음 등급으로 대체 시도`, err);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Google TTS 합성에 실패했습니다');
}
