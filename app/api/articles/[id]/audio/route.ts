import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { blobExists, putBlob } from '@/lib/blobStorage';
import { stripHtml } from '@/lib/stripHtml';
import { toFrenchBrackets } from '@/lib/frenchBrackets';
import { synthesizeKoreanSpeech } from '@/lib/googleTts';
import { createHash } from 'crypto';
import { allowRequest, clientIp } from '@/lib/rateLimit';

// 2026-10-09 비용 보호: 로그인 없이 누구나 부르는 주소라, 남/여 전환으로 매번 새로 만들게 하면 Google TTS 요금과
// 저장소 파일이 끝없이 늘었음 → 발행된 기사만, IP당 시간당 생성 횟수·서버 전체 하루 생성 횟수 제한,
// 반대 성별 음성도 (기사·성별·본문)별 같은 파일 이름으로 저장해 재사용.
const GEN_PER_IP_PER_HOUR = 6;
const GEN_PER_DAY = 300;
let dayKey = '';
let dayCount = 0;
const altVoiceCache = new Map<string, string>(); // 반대 성별 음성 파일 주소 (서버 재시작 전까지)

// 기사 "읽어주기" 오디오 — Google Cloud TTS(신경망 한국어 음성)로 기사당 1회만 생성해서
// Article.audioUrl에 캐싱해두고 이후 요청은 캐시된 파일을 그대로 재사용(무료 한도 절약).
// 본문(content)이 수정되면 app/api/articles/[id]/route.ts의 PUT에서 audioUrl을 null로 초기화하므로,
// 다음 "읽어주기" 요청 때 새 본문 기준으로 자동 재생성됨.
// GOOGLE_TTS_API_KEY가 없거나 호출이 실패하면 502를 반환하고, 프런트(ReadAloudButton)가
// 자동으로 예전 방식(브라우저 내장 음성합성)으로 대체함 (2026-09-12 신설)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: { author: { select: { gender: true } } },
  });
  if (!article || article.status !== 'PUBLISHED') return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 방문자가 재생 버튼 옆 남/여 전환으로 기본(작성 기자) 성별과 다른 목소리를 요청할 수 있음 (2026-09-12 신설).
  // 기본 성별 음성은 Article.audioUrl에, 반대 성별 음성은 (기사·성별·본문)별 고정 파일 이름으로 저장해 재사용 (2026-10-09).
  const defaultGender: 'MALE' | 'FEMALE' = article.author.gender === 'MALE' ? 'MALE' : 'FEMALE';
  const requestedGender = req.nextUrl.searchParams.get('gender');
  const effectiveGender: 'MALE' | 'FEMALE' =
    requestedGender === 'MALE' || requestedGender === 'FEMALE' ? requestedGender : defaultGender;
  const isDefaultVoice = effectiveGender === defaultGender;

  if (isDefaultVoice && article.audioUrl) {
    return NextResponse.json({ url: article.audioUrl, cached: true });
  }

  const text = `${toFrenchBrackets(article.title).replace(/\s+/g, ' ').trim()}. ${stripHtml(article.content)}`;
  const altName = `tts-${article.id}-${effectiveGender}-${createHash('sha1').update(text).digest('hex').slice(0, 12)}.mp3`;
  if (!isDefaultVoice) {
    if (!altVoiceCache.has(altName) && (await blobExists(altName).catch(() => false))) altVoiceCache.set(altName, `/api/blob/${altName}`);
    if (altVoiceCache.has(altName)) return NextResponse.json({ url: altVoiceCache.get(altName), cached: true });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (dayKey !== today) {
    dayKey = today;
    dayCount = 0;
  }
  if (dayCount >= GEN_PER_DAY || !allowRequest(`tts_${clientIp(req)}`, GEN_PER_IP_PER_HOUR, 3600_000)) {
    // 429면 프런트(ReadAloudButton)가 브라우저 내장 음성으로 대체
    return NextResponse.json({ error: '잠시 후 다시 시도해주세요' }, { status: 429 });
  }
  dayCount++;

  let buffer: Buffer;
  let tierUsed: string;
  try {
    const result = await synthesizeKoreanSpeech(text, effectiveGender);
    buffer = result.buffer;
    tierUsed = result.tierUsed;
  } catch (err) {
    console.error('[TTS] 기사 음성 생성 실패', article.id, err);
    return NextResponse.json({ error: '음성 생성에 실패했습니다' }, { status: 502 });
  }

  const filename = isDefaultVoice ? `tts-${article.id}-${createHash('sha1').update(text).digest('hex').slice(0, 12)}.mp3` : altName;
  await putBlob(filename, buffer, 'audio/mpeg');
  const url = `/api/blob/${filename}`;

  if (!isDefaultVoice) altVoiceCache.set(altName, url);
  if (isDefaultVoice) {
    // updatedAt은 @updatedAt이라 update() 호출만으로 자동 갱신됨 — 오디오 캐시 채우기는
    // "수정"이 아니므로 기존 값을 그대로 돌려줌 (2026-09-22)
    await prisma.article.update({
      where: { id: article.id },
      data: { audioUrl: url, updatedAt: article.updatedAt },
    });
  }

  return NextResponse.json({ url, cached: false, tierUsed });
}
