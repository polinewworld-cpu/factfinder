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

// 최고관리자(편집장) 계정 — 구글 로그인으로 이미 가입된 계정에 최고권한 부여.
// 아직 로그인 전이라 계정이 없으면 이번엔 건너뛰고, 다음 배포에서 로그인 후 재실행되면 자동으로 부여됨.
const chiefEmail = 'polinewworld@gmail.com';
const chiefUser = await prisma.user.findUnique({ where: { email: chiefEmail } });
if (chiefUser && chiefUser.role !== 'CHIEF_EDITOR') {
  await prisma.user.update({ where: { email: chiefEmail }, data: { role: 'CHIEF_EDITOR' } });
  console.log(`${chiefEmail} 계정에 편집장(최고권한) 부여 완료`);
} else if (chiefUser) {
  console.log(`${chiefEmail} 계정은 이미 편집장 권한`);
} else {
  console.log(`${chiefEmail} 계정이 아직 없어 권한 부여를 건너뜀 (구글 로그인 후 재배포 시 자동 반영)`);
}

console.log('기본 카테고리/키워드 확인 완료');
await prisma.$disconnect();
