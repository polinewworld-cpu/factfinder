// 테스트용 더미 데이터 — 실제 서비스 데이터가 아님.
// 안전하게 여러 번 재실행 가능(이미 있는 제목/이메일은 건드리지 않음).
// 실제 오픈 전엔 package.json build 스크립트에서 이 파일 실행 부분을 지워주세요.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// 1) 더미 작성자 계정 (이메일로 upsert — 재실행해도 중복 안 됨)
const authors = {
  reporter: await prisma.user.upsert({
    where: { email: 'dummy-reporter@factfinder.test' },
    update: {},
    create: { email: 'dummy-reporter@factfinder.test', name: '김기자', role: 'REPORTER' },
  }),
  columnist: await prisma.user.upsert({
    where: { email: 'dummy-columnist@factfinder.test' },
    update: {},
    create: { email: 'dummy-columnist@factfinder.test', name: '이논설', role: 'COLUMNIST' },
  }),
  editor: await prisma.user.upsert({
    where: { email: 'dummy-editor@factfinder.test' },
    update: {},
    create: { email: 'dummy-editor@factfinder.test', name: '박편집장', role: 'CHIEF_EDITOR' },
  }),
  reader: await prisma.user.upsert({
    where: { email: 'dummy-reader@factfinder.test' },
    update: {},
    create: { email: 'dummy-reader@factfinder.test', name: '최독자', role: 'READER' },
  }),
};

// 2) 카테고리/키워드는 seed-launch.mjs가 먼저 만들어둔 걸 그대로 참조
const categories = await prisma.category.findMany();
const catId = (name) => categories.find((c) => c.name === name)?.id;
const keywordExclusive = await prisma.keyword.findUnique({ where: { name: '단독' } });
const keywordPoll = await prisma.keyword.findUnique({ where: { name: '여론' } });

const articlesData = [
  { title: '국회, 내년도 예산안 심사 돌입…쟁점 법안 조율 관심', category: '정치', author: authors.reporter, status: 'PUBLISHED', days: 1, views: 512, keyword: keywordExclusive },
  { title: '여야, 지방선거 룰 놓고 이견…협상 재개 예정', category: '정치', author: authors.reporter, status: 'PUBLISHED', days: 2, views: 340 },
  { title: '국회 상임위, 법안 심사 일정 조율', category: '정치', author: authors.editor, status: 'PUBLISHED', days: 0, views: 980, top: true },
  { title: '정부, 중소기업 지원책 발표…현장 반응은 엇갈려', category: '정치', author: authors.reporter, status: 'DRAFT', days: 0, views: 0 },
  { title: '아세안 정상회의 개막…역내 경제협력 논의', category: '국제', author: authors.columnist, status: 'PUBLISHED', days: 3, views: 421 },
  { title: '국제유가 소폭 상승…공급 우려 반영', category: '국제', author: authors.reporter, status: 'PUBLISHED', days: 4, views: 210 },
  { title: '유엔, 기후변화 대응 보고서 발표', category: '국제', author: authors.columnist, status: 'PUBLISHED', days: 5, views: 176 },
  { title: '환율 변동성 확대…기업 대응 분주', category: '국제', author: authors.reporter, status: 'PUBLISHED', days: 1, views: 298, keyword: keywordPoll },
  { title: '폭염특보 확대…온열질환 주의 당부', category: '사회', author: authors.reporter, status: 'PUBLISHED', days: 0, views: 654 },
  { title: '전국 대학 등록금 동결 기조 유지', category: '사회', author: authors.editor, status: 'PUBLISHED', days: 6, views: 145 },
  { title: '택배노조, 처우개선 요구하며 집회', category: '사회', author: authors.reporter, status: 'PUBLISHED', days: 2, views: 388, keyword: keywordExclusive, poll: true },
  { title: '고령운전자 교통사고 예방대책 시행', category: '사회', author: authors.reporter, status: 'DRAFT', days: 0, views: 0 },
  { title: '지자체, 청년 일자리 박람회 개최', category: '사회', author: authors.columnist, status: 'PUBLISHED', days: 3, views: 233 },
  { title: '지역 영화제 개막…관객 발길 이어져', category: '문화', author: authors.columnist, status: 'PUBLISHED', days: 2, views: 502, comments: true },
  { title: '전통시장 야시장 축제 인기몰이', category: '문화', author: authors.reporter, status: 'PUBLISHED', days: 4, views: 267, comments: true },
  { title: '청년 예술가 지원사업 참가자 모집', category: '문화', author: authors.reporter, status: 'PUBLISHED', days: 5, views: 98 },
  { title: '박물관 특별전, 다음달까지 연장', category: '문화', author: authors.columnist, status: 'PUBLISHED', days: 7, views: 187 },
  { title: '가을 축제 시즌 본격화(작성중)', category: '문화', author: authors.columnist, status: 'AUTOSAVE', days: 0, views: 0 },
];

const bodyHtml = (title) =>
  `<p>${title} 관련 세부 내용입니다. 이 기사는 테스트 목적으로 생성된 더미 기사이며, 실제 취재 내용이 아닙니다.</p>` +
  `<p>레이아웃과 기능(조회수, 키워드, 댓글, 카드뉴스, 설문 등) 확인을 위해 자동 생성되었습니다.</p>`;

let created = 0;
for (const a of articlesData) {
  const exists = await prisma.article.findFirst({ where: { title: a.title } });
  if (exists) continue;

  const article = await prisma.article.create({
    data: {
      title: a.title,
      content: bodyHtml(a.title),
      excerpt: `${a.title} — 테스트용 더미 기사입니다.`,
      coverImageUrl: `https://picsum.photos/seed/${encodeURIComponent(a.title)}/800/450`,
      status: a.status,
      viewCount: a.views,
      isFrontpageTop: !!a.top,
      authorId: a.author.id,
      categoryId: catId(a.category),
      publishedAt: a.status === 'PUBLISHED' ? daysAgo(a.days) : null,
      keywords: a.keyword ? { connect: { id: a.keyword.id } } : undefined,
    },
  });
  created++;

  if (a.poll) {
    await prisma.poll.create({
      data: {
        articleId: article.id,
        question: '이 사안에 대해 어떻게 생각하시나요?',
        options: {
          create: [
            { text: '찬성한다', order: 0 },
            { text: '반대한다', order: 1 },
            { text: '잘 모르겠다', order: 2 },
          ],
        },
      },
    });
  }

  if (a.comments) {
    await prisma.comment.createMany({
      data: [
        { articleId: article.id, userId: authors.reader.id, content: '좋은 기사 잘 봤습니다.' },
        { articleId: article.id, userId: authors.editor.id, content: '추가 취재가 더 필요해 보이네요.' },
      ],
    });
  }
}

console.log(`더미 데이터 확인 완료 (신규 기사 ${created}건 생성, 나머지는 이미 존재해 건너뜀)`);
await prisma.$disconnect();
