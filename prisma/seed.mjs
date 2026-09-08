import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const user = await prisma.user.create({
  data: { email: 'kanghyun@factfinder.tv', name: '강현', role: 'REPORTER', gender: 'MALE' },
});

// 새 카테고리: 정치/국제/사회/문화 (평면, 외교·경제·미디어는 정치로 통합)
const categories = await Promise.all(
  ['정치', '국제', '사회', '문화'].map((name, i) =>
    prisma.category.create({ data: { name, slug: `cat-${i}-${name}` } })
  )
);

// 관리자가 미리 만들어둔 키워드 목록
const keywords = await Promise.all(
  ['단독', '여론'].map((name) => prisma.keyword.create({ data: { name } }))
);

console.log(JSON.stringify({
  userId: user.id,
  politicsCategoryId: categories[0].id,
  keywordIds: Object.fromEntries(keywords.map(k => [k.name, k.id])),
}, null, 2));

await prisma.$disconnect();
