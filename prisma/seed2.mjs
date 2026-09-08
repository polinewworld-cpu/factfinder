import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const reporter = await prisma.user.upsert({
  where: { email: 'reporter@factfinder.tv' },
  update: {},
  create: { email: 'reporter@factfinder.tv', name: '박기자', role: 'REPORTER', gender: 'FEMALE' },
});
const columnist = await prisma.user.upsert({
  where: { email: 'columnist@factfinder.tv' },
  update: {},
  create: { email: 'columnist@factfinder.tv', name: '최논설', role: 'COLUMNIST', gender: 'MALE' },
});
const chief = await prisma.user.upsert({
  where: { email: 'chief@factfinder.tv' },
  update: {},
  create: { email: 'chief@factfinder.tv', name: '김편집장', role: 'CHIEF_EDITOR' },
});
const reader = await prisma.user.upsert({
  where: { email: 'reader@factfinder.tv' },
  update: {},
  create: { email: 'reader@factfinder.tv', name: '일반독자', role: 'READER' },
});

const category = await prisma.category.findFirst({ where: { name: '정치' } });

console.log(JSON.stringify({
  reporterId: reporter.id, columnistId: columnist.id, chiefId: chief.id, readerId: reader.id,
  categoryId: category.id,
}, null, 2));
await prisma.$disconnect();
