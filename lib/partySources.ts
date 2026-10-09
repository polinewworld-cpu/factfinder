// 정당 홈페이지 사진 게시판 수집 (2026-10-09, 사진 뱅크 3단계) — 자동 수집기(lib/photoCollector.ts)가 쓴다.
// 조사 결과(10-09):
//  - 더불어민주당: 포토갤러리 /main/sub/contents/gallery-photo.php — 사진마다 제목·설명(인물 이름 포함)·날짜·원본 다운로드 주소. 첫 요청에 쿠키를 주고 307로 되돌림
//  - 개혁신당: 사진자료 /news/photo → 글마다 사진 여러 장(home.reformparty.kr/assets/cms/…), 설명은 제목뿐
//  - 국민의힘: 사진 게시판 없음(보도자료·논평·의원실 행사 모두 글만) — 네이버 "제공" 사진으로 대신
//  - 새미래민주당: 홈페이지 주소 미확인
import type { SourceType } from '@/lib/photoBankRules';

export type PartyPhoto = {
  origin: 'minjoo' | 'reform';
  image: string; // 원본(가능하면 원본 해상도)
  thumb: string;
  pageUrl: string;
  title: string;
  caption: string;
  takenAt: string | null; // YYYY-MM-DD
  provider: string;
  sourceType: SourceType;
  credit: string;
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const strip = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/[​﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// 쿠키를 주고 되돌리는 사이트용 — 리다이렉트를 직접 따라가며 쿠키를 붙임
async function getHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  const cookies = new Map<string, string>();
  let target = url;
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(target, {
      redirect: 'manual',
      headers: { 'User-Agent': UA, ...(cookies.size ? { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}) },
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    });
    const set = (res.headers as any).getSetCookie?.() ?? (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')!] : []);
    for (const c of set) {
      const [kv] = String(c).split(';');
      const i = kv.indexOf('=');
      if (i > 0) cookies.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      target = new URL(res.headers.get('location')!, target).toString();
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { html: await res.text(), finalUrl: target };
  }
  throw new Error('리다이렉트가 너무 많습니다');
}

const ymd = (s: string | undefined | null) => s?.match(/(\d{4})[-.](\d{1,2})[-.](\d{1,2})/)?.slice(1).map((x, i) => (i ? x.padStart(2, '0') : x)).join('-') ?? null;

export async function minjooPhotos(): Promise<PartyPhoto[]> {
  const base = 'https://theminjoo.kr/main/sub/contents/gallery-photo.php';
  const { html } = await getHtml(base);
  const out: PartyPhoto[] = [];
  for (const block of html.split(/<div id="gallery-photo_\d+" class="gallery-popup/).slice(1)) {
    const b = block.slice(0, 4000);
    const thumb = b.match(/<img src="([^"]+)"/)?.[1];
    if (!thumb) continue;
    const original = b.match(/download\.php\?url=([^"&]+)/)?.[1];
    const title = strip(b.match(/class="gallery-photo__title">([\s\S]*?)<\/h3>/)?.[1] ?? '');
    const desc = strip(b.match(/class="gallery-photo__desc">([\s\S]*?)<\/p>/)?.[1] ?? '');
    out.push({
      origin: 'minjoo',
      image: original ? decodeURIComponent(original) : thumb,
      thumb,
      pageUrl: base,
      title,
      caption: desc || title,
      takenAt: ymd(b.match(/class="time"><span>([^<]+)/)?.[1]),
      provider: '더불어민주당',
      sourceType: 'PARTY',
      credit: '사진=더불어민주당',
    });
  }
  return out;
}

export async function reformPhotos(maxPosts = 6): Promise<PartyPhoto[]> {
  const { html } = await getHtml('https://reformparty.kr/news/photo');
  const ids = Array.from(new Set([...html.matchAll(/href="\/news\/photo\/(\d+)/g)].map((m) => Number(m[1])))).sort((a, b) => b - a).slice(0, maxPosts);
  const out: PartyPhoto[] = [];
  for (const id of ids) {
    const page = await getHtml(`https://reformparty.kr/news/photo/${id}`).catch(() => null);
    if (!page) continue;
    const title = strip(page.html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ?? '').replace(/\s*\|\s*개혁신당\s*$/, '');
    const date = ymd(title) ?? ymd(page.html.match(/(\d{4}-\d{2}-\d{2})/)?.[1]);
    const imgs = Array.from(new Set([...page.html.matchAll(/https:\/\/home\.reformparty\.kr\/assets\/cms\/[^"')\s]+\.(?:jpe?g|png|webp)/gi)].map((m) => m[0])));
    for (const img of imgs) {
      out.push({
        origin: 'reform',
        image: img,
        thumb: img,
        pageUrl: page.finalUrl,
        title,
        caption: title,
        takenAt: date,
        provider: '개혁신당',
        sourceType: 'PARTY',
        credit: '사진=개혁신당',
      });
    }
  }
  return out;
}
