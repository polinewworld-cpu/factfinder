// 옛 사이트(factfinder.tv, 다다미디어 CMS) 기사 이관 도구 (2026-10-08 신설)
//
// 다다미디어의 DB 덤프 없이, 공개된 기사 페이지(/news/view.php?idx=N)를 그대로 읽어와 새 DB로 옮긴다.
// 모든 중간 결과는 프로젝트 폴더 legacy-import/ 에 남는다(.gitignore 처리됨) — 이 폴더 자체가 옛 사이트 원본 백업이다.
//
// 단계 (순서대로 실행, 각 단계는 몇 번을 다시 돌려도 안전 — 이미 받은 건 건너뜀):
//   node scripts/legacy-import.mjs crawl  [--from 1] [--to 3400]  옛 기사 HTML 저장 → legacy-import/html/N.html
//   node scripts/legacy-import.mjs parse                           HTML → legacy-import/articles.json (+ 기자·카테고리 목록 출력)
//   node scripts/legacy-import.mjs images                          본문 사진 원본 저장 → legacy-import/images/ (용량 합계 출력)
//   node scripts/legacy-import.mjs import [--commit] [--limit N]   새 DB에 기사 생성. --commit 없으면 리허설(아무것도 안 씀)
//
// import 단계 설정 파일 (없으면 기본값):
//   legacy-import/category-map.json  {"정치·사회>대통령실": "정치", "사법리스크": "정치", ...}  — 옛 분류 → 새 카테고리 이름. 없는 건 카테고리 없음
//   legacy-import/reporters.json     {"김남훈": "someone@gmail.com", ...}  — 옛 기자명 → 새 사이트 가입 이메일. 없는 기자는 자리표시 계정 생성
//
// 사진 저장 위치(import 단계):
//   기본: Supabase Storage(SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 필요) 'uploads' 버킷에 legacy-… 파일명으로 올리고 /api/blob/… 로 참조
//   --image-base https://…/  : 업로드 없이 본문 주소만 그 경로로 바꿈 (다른 저장소에 legacy-import/images 폴더를 직접 올린 경우)
//
// DB는 .env의 DATABASE_URL(Prisma 기본 동작)을 쓴다 — 운영/개발 어느 DB에 넣는지 반드시 확인하고 --commit 할 것.

import { promises as fs, existsSync } from 'fs';
import path from 'path';
import { parseDocument } from 'htmlparser2';
import * as DU from 'domutils';
import render from 'dom-serializer';
import sanitizeHtml from 'sanitize-html';

const ORIGIN = 'https://www.factfinder.tv';
const ROOT = path.join(process.cwd(), 'legacy-import');
const HTML_DIR = path.join(ROOT, 'html');
const IMG_DIR = path.join(ROOT, 'images');
const ARTICLES_JSON = path.join(ROOT, 'articles.json');
const DELAY_MS = 300; // 옛 서버에 부담 주지 않도록 요청 간격

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args[i + 1];
};
const flag = (name) => args.includes(`--${name}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- crawl ----------
async function crawl() {
  await fs.mkdir(HTML_DIR, { recursive: true });
  const from = Number(opt('from', 1));
  const to = Number(opt('to', await latestIdx()));
  let saved = 0, missing = 0, skipped = 0;
  for (let idx = from; idx <= to; idx++) {
    const file = path.join(HTML_DIR, `${idx}.html`);
    const missFile = path.join(HTML_DIR, `${idx}.missing`);
    if (existsSync(file) || existsSync(missFile)) { skipped++; continue; }
    const html = await fetchText(`${ORIGIN}/news/view.php?idx=${idx}`);
    if (!html.includes('article-head-title')) {
      await fs.writeFile(missFile, ''); // 삭제된 기사 — 다음 실행 때 다시 요청하지 않도록 표시
      missing++;
    } else {
      await fs.writeFile(file, html);
      saved++;
    }
    if ((idx - from) % 50 === 0) console.log(`crawl ${idx}/${to} (저장 ${saved}, 없음 ${missing}, 건너뜀 ${skipped})`);
    await sleep(DELAY_MS);
  }
  console.log(`crawl 완료 — 저장 ${saved}, 없음(삭제된 기사) ${missing}, 이미 있던 것 ${skipped}`);
}

// 홈페이지에 노출된 기사 번호 중 최댓값 = 최신 기사 번호
async function latestIdx() {
  const home = await fetchText(`${ORIGIN}/`);
  const ids = [...home.matchAll(/(?:news\/|article\/|idx=)(\d+)/g)].map((m) => Number(m[1]));
  return Math.max(...ids);
}

async function fetchText(url, tries = 3) {
  for (let t = 1; ; t++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'factfinder-migration/1.0' } });
      return await res.text();
    } catch (e) {
      if (t >= tries) throw e;
      await sleep(2000 * t);
    }
  }
}

// ---------- parse ----------
const byClass = (node, cls) =>
  DU.findOne((el) => (el.attribs?.class ?? '').split(/\s+/).includes(cls), [node].flat(), true);
const allByClass = (node, cls) =>
  DU.findAll((el) => (el.attribs?.class ?? '').split(/\s+/).includes(cls), [node].flat());
const text = (el) => (el ? DU.textContent(el).replace(/\s+/g, ' ').trim() : '');
const kstDate = (s) => (s ? new Date(s.replace(' ', 'T') + '+09:00').toISOString() : null);

function parseArticle(idx, html) {
  const doc = parseDocument(html, { decodeEntities: true });
  const title = text(byClass(doc, 'article-head-title'));
  const nav = byClass(doc, 'article-head-nav');
  const categoryPath = nav ? DU.findAll((el) => el.name === 'a', nav.children).map(text).filter((t) => t && t !== 'HOME') : [];

  const infoItems = byClass(doc, 'info-text') ? DU.findAll((el) => el.name === 'li', byClass(doc, 'info-text').children).map(text) : [];
  const reporterRaw = infoItems.find((t) => /기자|논설|칼럼|편집/.test(t)) ?? infoItems[0] ?? '';
  const reporter = reporterRaw.replace(/\s*(기자|논설위원|칼럼니스트|편집장|객원기자)\s*$/, '').trim() || '팩트파인더';
  const registered = infoItems.find((t) => t.startsWith('등록'))?.replace('등록', '').trim();
  const modified = infoItems.find((t) => t.startsWith('수정'))?.replace('수정', '').trim();

  const view = DU.findOne((el) => el.attribs?.id === 'viewContent', doc.children, true);
  const subtitles = view ? allByClass(view, 'subj').flatMap((ul) => DU.findAll((el) => el.name === 'li', ul.children).map(text)).filter(Boolean) : [];
  const body = (view && byClass(view, 'fr-view')) || view;
  const contentHtml = body ? convertFroala(body) : '';

  return {
    legacyId: idx,
    title,
    subtitles: subtitles.slice(0, 3),
    reporter,
    categoryPath,
    publishedAt: kstDate(registered),
    updatedAt: kstDate(modified) ?? kstDate(registered),
    contentHtml,
    images: [...contentHtml.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]),
  };
}

// Froala 본문 → 새 에디터 형식. 사진+캡션은 <figure class="article-figure">로, 유튜브는 embed-youtube 래퍼로.
function convertFroala(body) {
  // 기사 하단 공유/후원 버튼 등 본문 아닌 것 제거
  for (const el of DU.findAll((e) => ['script', 'style', 'button'].includes(e.name) || /button-container|subj/.test(e.attribs?.class ?? ''), body.children)) {
    DU.removeElement(el);
  }
  let html = render(body.children, { decodeEntities: false });

  // 캡션 있는 사진: <span class="fr-img-caption …"><span class="fr-img-wrap"><img …><span class="fr-inner">캡션</span></span></span>
  html = html.replace(
    /<span[^>]*class="[^"]*fr-img-caption[^"]*"[^>]*>\s*<span[^>]*fr-img-wrap[^>]*>\s*(<img[^>]*>)\s*<span[^>]*fr-inner[^>]*>([\s\S]*?)<\/span>\s*<\/span>\s*<\/span>/g,
    (_m, img, cap) => `</p><figure class="article-figure">${img}<figcaption>${cap.replace(/(<br\s*\/?>\s*)+$/i, '').trim()}</figcaption></figure><p>`,
  );
  // 유튜브: 프로토콜 생략 주소(//www.youtube.com) 보정 + 새 에디터 래퍼
  html = html.replace(/<iframe([^>]*?)src="(?:https?:)?\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([^"?]+)[^"]*"([^>]*)><\/iframe>/g,
    (_m, _a, id) => `</p><div class="embed-youtube" contenteditable="false"><iframe src="https://www.youtube.com/embed/${id}" width="560" height="315" frameborder="0" allowfullscreen></iframe></div><p>`);
  // 옛 사진 주소(/data/…, factfinder.tv/data/…)를 절대주소로 통일 — import 단계에서 새 저장소 주소로 치환
  html = html.replace(/src="(?:https?:\/\/(?:www\.)?factfinder\.tv)?(\/data\/[^"]+)"/g, (_m, p) => `src="${ORIGIN}${p}"`);

  return sanitizeLegacy(html).replace(/<p>\s*<\/p>/g, '');
}

// lib/sanitizeArticle.ts와 같은 허용 규칙 (스크립트는 TS를 직접 import할 수 없어 복제 — 그쪽을 바꾸면 여기도 맞출 것)
function sanitizeLegacy(html) {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 'mark', 'a', 'img', 'blockquote', 'iframe',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'figure', 'figcaption'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'], img: ['src', 'alt'], figure: ['class'],
      div: ['class', 'contenteditable'], blockquote: ['class', 'data-instgrm-permalink'],
      iframe: ['src', 'width', 'height', 'title', 'frameborder', 'allowfullscreen'],
    },
    allowedIframeHostnames: ['www.youtube.com'],
    allowedSchemes: ['http', 'https'],
    nonTextTags: ['script', 'style', 'textarea', 'option', 'button'],
    transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }) },
  });
}

async function parse() {
  const files = (await fs.readdir(HTML_DIR)).filter((f) => f.endsWith('.html'));
  const out = [];
  for (const f of files) {
    const idx = Number(f.replace('.html', ''));
    try {
      const a = parseArticle(idx, await fs.readFile(path.join(HTML_DIR, f), 'utf8'));
      if (!a.title || !a.contentHtml) { console.warn(`#${idx}: 제목/본문 없음 — 제외`); continue; }
      out.push(a);
    } catch (e) {
      console.warn(`#${idx}: 파싱 실패 — ${e.message}`);
    }
  }
  out.sort((a, b) => a.legacyId - b.legacyId);
  await fs.writeFile(ARTICLES_JSON, JSON.stringify(out, null, 1));

  const count = (key) => out.reduce((m, a) => m.set(key(a), (m.get(key(a)) ?? 0) + 1), new Map());
  console.log(`parse 완료 — 기사 ${out.length}건 → ${path.relative(process.cwd(), ARTICLES_JSON)}`);
  console.log('\n기자별 기사 수:'); for (const [k, v] of [...count((a) => a.reporter)].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
  console.log('\n옛 분류별 기사 수 (category-map.json 키로 쓰는 값):'); for (const [k, v] of [...count((a) => a.categoryPath.join('>'))].sort((a, b) => b[1] - a[1])) console.log(`  ${k || '(없음)'}: ${v}`);
  console.log(`\n사진 수: ${out.reduce((n, a) => n + a.images.length, 0)}`);
}

// ---------- images ----------
const localImagePath = (url) => path.join(IMG_DIR, decodeURIComponent(new URL(url).pathname).replace(/^\/data\//, ''));

async function images() {
  const articles = JSON.parse(await fs.readFile(ARTICLES_JSON, 'utf8'));
  const urls = [...new Set(articles.flatMap((a) => a.images).filter((u) => u.startsWith(`${ORIGIN}/data/`)))];
  let bytes = 0, got = 0, failed = 0;
  for (const [i, url] of urls.entries()) {
    const file = localImagePath(url);
    if (existsSync(file)) { bytes += (await fs.stat(file)).size; continue; }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, buf);
      bytes += buf.length; got++;
    } catch (e) {
      failed++; console.warn(`사진 실패 ${url} — ${e.message}`);
    }
    if (i % 100 === 0) console.log(`images ${i}/${urls.length} (누적 ${(bytes / 1048576).toFixed(1)}MB)`);
    await sleep(DELAY_MS / 3);
  }
  console.log(`images 완료 — 전체 ${urls.length}장, 새로 받음 ${got}, 실패 ${failed}, 총 용량 ${(bytes / 1048576).toFixed(1)}MB`);
}

// ---------- import ----------
async function importArticles() {
  const commit = flag('commit');
  const limit = Number(opt('limit', Infinity));
  const imageBase = opt('image-base', null);
  const articles = JSON.parse(await fs.readFile(ARTICLES_JSON, 'utf8')).slice(0, limit);
  const readJson = async (f, def) => (existsSync(path.join(ROOT, f)) ? JSON.parse(await fs.readFile(path.join(ROOT, f), 'utf8')) : def);
  const categoryMap = await readJson('category-map.json', {});
  const reporterMap = await readJson('reporters.json', {});

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  let supabase = null;
  if (commit && !imageBase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 필요 (또는 --image-base 지정)');
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }

  const categories = new Map((await prisma.category.findMany()).map((c) => [c.name, c.id]));
  const existing = new Set((await prisma.article.findMany({ where: { legacyId: { not: null } }, select: { legacyId: true } })).map((a) => a.legacyId));
  const userCache = new Map();
  const stats = { created: 0, skipped: 0, unmappedCategory: new Set(), placeholderReporters: new Set() };

  // 옛 기자 → 새 계정. reporters.json에 이메일이 있으면 그 계정, 없으면 로그인 불가능한 자리표시 계정(나중에 관리자가 기사 작성자 변경 가능)
  async function authorId(name) {
    if (userCache.has(name)) return userCache.get(name);
    const email = reporterMap[name] ?? `legacy-${Buffer.from(name).toString('hex')}@legacy.invalid`;
    if (!reporterMap[name]) stats.placeholderReporters.add(name);
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user && commit) {
      user = await prisma.user.create({ data: { email, name, nickname: `${name} 기자(이관)`, role: 'REPORTER' } });
    }
    userCache.set(name, user?.id ?? 'dry-run');
    return userCache.get(name);
  }

  async function storeImage(url) {
    if (!url.startsWith(`${ORIGIN}/data/`)) return url; // 외부 사진은 그대로
    const rel = decodeURIComponent(new URL(url).pathname).replace(/^\/data\//, '');
    if (imageBase) return imageBase.replace(/\/?$/, '/') + rel;
    const filename = `legacy-${rel.replace(/[\/\\]/g, '-')}`;
    if (commit) {
      const file = localImagePath(url);
      if (!existsSync(file)) { console.warn(`  사진 원본 없음(images 단계 먼저): ${url}`); return url; }
      const ext = path.extname(file).slice(1).toLowerCase();
      const type = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[ext] ?? 'application/octet-stream';
      const { error } = await supabase.storage.from('uploads').upload(filename, await fs.readFile(file), { contentType: type, upsert: true });
      if (error) throw error;
    }
    return `/api/blob/${filename}`;
  }

  for (const a of articles) {
    if (existing.has(a.legacyId)) { stats.skipped++; continue; }
    let content = a.contentHtml;
    const urlMap = new Map();
    for (const u of new Set(a.images)) urlMap.set(u, await storeImage(u));
    for (const [from, to] of urlMap) content = content.split(`src="${from}"`).join(`src="${to}"`);

    const catKey = a.categoryPath.join('>');
    const catName = categoryMap[catKey] ?? categoryMap[a.categoryPath.at(-1)] ?? categoryMap[a.categoryPath[0]];
    if (!catName || !categories.has(catName)) stats.unmappedCategory.add(catKey || '(없음)');
    const plain = content.replace(/<figcaption[\s\S]*?<\/figcaption>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const data = {
      legacyId: a.legacyId,
      title: a.title,
      subtitle1: a.subtitles[0] ?? null,
      subtitle2: a.subtitles[1] ?? null,
      subtitle3: a.subtitles[2] ?? null,
      content,
      excerpt: plain.slice(0, 150),
      coverImageUrl: urlMap.get(a.images[0]) ?? null,
      status: 'PUBLISHED',
      authorId: await authorId(a.reporter),
      categoryId: catName ? categories.get(catName) ?? null : null,
      publishedAt: a.publishedAt ? new Date(a.publishedAt) : null,
      createdAt: a.publishedAt ? new Date(a.publishedAt) : undefined,
    };
    if (commit) await prisma.article.create({ data });
    stats.created++;
    if (stats.created % 100 === 0) console.log(`import ${stats.created}건…`);
  }
  await prisma.$disconnect();

  console.log(`\nimport ${commit ? '완료' : '리허설(DB에 아무것도 쓰지 않음)'} — ${commit ? '생성' : '생성 예정'} ${stats.created}건, 이미 이관된 것 ${stats.skipped}건`);
  if (stats.unmappedCategory.size) console.log(`카테고리 매핑 없음(카테고리 없이 들어감): ${[...stats.unmappedCategory].join(', ')}`);
  if (stats.placeholderReporters.size) console.log(`자리표시 계정으로 들어갈 기자: ${[...stats.placeholderReporters].join(', ')}`);
}

const commands = { crawl, parse, images, import: importArticles };
if (!commands[cmd]) {
  console.log('사용법: node scripts/legacy-import.mjs <crawl|parse|images|import> — 파일 맨 위 설명 참고');
  process.exit(1);
}
await commands[cmd]();
