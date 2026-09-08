import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const chief = await prisma.user.findUnique({ where: { email: 'chief@factfinder.tv' } });
const columnist = await prisma.user.findUnique({ where: { email: 'columnist@factfinder.tv' } });
const cats = Object.fromEntries((await prisma.category.findMany()).map((c) => [c.name, c.id]));
const dandok = await prisma.keyword.findUnique({ where: { name: '단독' } });
const yeolon = await prisma.keyword.findUnique({ where: { name: '여론' } });

const samples = [
  { title: '개각 발표, 6개 부처 장관 후보자 지명', category: '정치', kw: [], img: 'https://picsum.photos/seed/a1/800/600', top: true },
  { title: '한미 정상 통화, 안보협력 강화 논의', category: '국제', kw: [], img: 'https://picsum.photos/seed/a2/800/500' },
  { title: '[단독] 여야, 예산안 협상 막판 진통', category: '정치', kw: ['단독'], img: 'https://picsum.photos/seed/a3/800/500' },
  { title: '[리얼미터] 지지율 8주 연속 하락', category: '정치', kw: ['여론'], img: null },
  { title: '가을 정기 인사이동, 부처별 후속 인사 촉각', category: '사회', kw: [], img: 'https://picsum.photos/seed/a5/800/500' },
  { title: '올해 영화제 개막작 라인업 공개', category: '문화', kw: [], img: 'https://picsum.photos/seed/a6/800/500' },
  { title: '[단독] 국회 예결위, 심야 회의 파행', category: '정치', kw: ['단독'], img: 'https://picsum.photos/seed/a7/800/500' },
  { title: 'G7 정상회의 의제 조율 착수', category: '국제', kw: [], img: 'https://picsum.photos/seed/a8/800/500' },
];

for (const s of samples) {
  await prisma.article.create({
    data: {
      title: s.title,
      content: `<p>${s.title}에 대한 본문 내용입니다. 데모용 샘플 텍스트로, 실제 발행 시 위지윅 에디터로 작성된 본문이 들어갑니다.</p>`,
      excerpt: s.title,
      coverImageUrl: s.img,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      isFrontpageTop: !!s.top,
      authorId: (s.kw.includes('단독') ? chief.id : columnist.id),
      categoryId: cats[s.category],
      keywords: {
        connect: s.kw.map((k) => (k === '단독' ? { id: dandok.id } : { id: yeolon.id })),
      },
    },
  });
}

console.log('샘플 기사', samples.length, '건 생성 완료');
await prisma.$disconnect();
