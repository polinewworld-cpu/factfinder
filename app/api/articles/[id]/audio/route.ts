import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { putBlob } from '@/lib/blobStorage';
import { stripHtml } from '@/lib/stripHtml';
import { synthesizeKoreanSpeech } from '@/lib/googleTts';
import { randomUUID } from 'crypto';

// 기사 "읽어주기" 오디오 — Google Cloud TTS(신경망 한국어 음성)로 기사당 1회만 생성해서
// Article.audioUrl에 캐싱해두고 이후 요청은 캐시된 파일을 그대로 재사용(무료 한도 절약).
// 본문(content)이 수정되면 app/api/articles/[id]/route.ts의 PUT에서 audioUrl을 null로 초기화하므로,
// 다음 "읽어주기" 요청 때 새 본문 기준으로 자동 재생성됨.
// GOOGLE_TTS_API_KEY가 없거나 호출이 실패하면 502를 반환하고, 프런트(ReadAloudButton)가
// 자동으로 예전 방식(브라우저 내장 음성합성)으로 대체함 (2026-09-12 신설)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: { author: true },
  });
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 방문자가 재생 버튼 옆 남/여 전환으로 기본(작성 기자) 성별과 다른 목소리를 요청할 수 있음 (2026-09-12 신설).
  // 기본 성별과 같을 때만 Article.audioUrl에 캐싱해서 재사용하고, 일부러 다른 성별로 바꿔 들을 때는
  // 매번 새로 생성함(자주 쓰이는 경우가 아니라서 캐시 슬롯을 따로 두지 않음).
  const defaultGender: 'MALE' | 'FEMALE' = article.author.gender === 'MALE' ? 'MALE' : 'FEMALE';
  const requestedGender = req.nextUrl.searchParams.get('gender');
  const effectiveGender: 'MALE' | 'FEMALE' =
    requestedGender === 'MALE' || requestedGender === 'FEMALE' ? requestedGender : defaultGender;
  const isDefaultVoice = effectiveGender === defaultGender;

  if (isDefaultVoice && article.audioUrl) {
    return NextResponse.json({ url: article.audioUrl, cached: true });
  }

  const text = `${article.title}. ${stripHtml(article.content)}`;

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

  const filename = `tts-${article.id}-${randomUUID()}.mp3`;
  await putBlob(filename, buffer, 'audio/mpeg');
  const url = `/api/blob/${filename}`;

  if (isDefaultVoice) {
    await prisma.article.update({ where: { id: article.id }, data: { audioUrl: url } });
  }

  return NextResponse.json({ url, cached: false, tierUsed });
}
