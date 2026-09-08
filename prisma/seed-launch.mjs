// 배포(빌드)마다 안전하게 재실행 가능한 최소 기본 데이터 — upsert만 사용, 가짜 유저/샘플 기사는 넣지 않음.
// 실제 운영에 필요한 카테고리/키워드 체계만 보장한다.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const categories = ['정치', '국제', '사회', '문화'];
for (let i = 0; i < categories.length; i++) {
  const name = categories[i];
  await prisma.category.upsert({
    where: { slug: `cat-${i}-${name}` },
    update: {},
    create: { name, slug: `cat-${i}-${name}`, order: i },
  });
}

const keywords = ['단독', '여론'];
for (const name of keywords) {
  await prisma.keyword.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

console.log('기본 카테고리/키워드 확인 완료');
await prisma.$disconnect();
