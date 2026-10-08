// 2.0 더미 기사 영구 삭제 — "더미기사 삭제.bat"이 실행 (2026-10-08, 사장님 지시: 2.0에서 쓴 기사는 전부 더미)
// 대상: 옛 사이트에서 이관된 기사(legacyId 있음)를 제외한 모든 기사. 댓글·본문사진·투표·저장(북마크)은 DB 설정상 함께 삭제됨.
// 삭제 전 전체 내용을 legacy-import/backup-dummy-articles-full-<시각>.json 에 백업하고, "삭제"를 직접 입력해야 진행한다.
import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync } from 'fs';
import readline from 'readline/promises';

const prisma = new PrismaClient();
const where = { legacyId: null };
const targets = await prisma.article.findMany({ where, include: { images: true, comments: true, poll: { include: { options: true } } } });
const host = new URL(process.env.DATABASE_URL).host;

console.log(`DB: ${host}`);
console.log(`삭제 대상: 더미 기사 ${targets.length}건 (이관된 옛 기사 ${await prisma.article.count({ where: { legacyId: { not: null } } })}건은 유지)`);
for (const a of targets.slice(0, 5)) console.log(`  - ${a.title.slice(0, 40)}`);
if (targets.length > 5) console.log(`  … 외 ${targets.length - 5}건`);

if (targets.length === 0) {
  console.log('[완료] 지울 더미 기사가 없습니다.');
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('\n정말 삭제하려면 삭제 라고 입력하고 Enter: ')).trim();
  rl.close();
  if (answer !== '삭제') {
    console.log('[취소] 아무것도 지우지 않았습니다.');
  } else {
    mkdirSync('legacy-import', { recursive: true });
    const file = `legacy-import/backup-dummy-articles-full-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    writeFileSync(file, JSON.stringify(targets, null, 1));
    const { count } = await prisma.article.deleteMany({ where });
    console.log(`[완료] 더미 기사 ${count}건 삭제. 지우기 전 내용 백업: ${file}`);
  }
}
await prisma.$disconnect();
