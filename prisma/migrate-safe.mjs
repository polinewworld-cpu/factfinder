// 배포(빌드)마다 실행되는 DB 스키마 반영 스크립트 — `prisma db push --accept-data-loss`를 대체 (2026-10-08).
// 정식 마이그레이션(prisma/migrations)만 적용하므로, 데이터를 지우는 변경은 마이그레이션 파일에 명시적으로 적지 않는 한 일어나지 않는다.
//
// 최초 1회 전환 처리: 예전 db push 방식으로 만들어진 DB(= _prisma_migrations 테이블 없음)는
// 0_init을 "이미 적용됨"으로 등록(baseline)한 뒤 나머지 마이그레이션을 적용한다.
// 단, DB 실제 구조와 schema.prisma의 차이가 "0_init 이후 마이그레이션 파일 내용"과 정확히 일치할 때만 진행하고,
// 그 외 차이가 하나라도 있으면 빌드를 실패시킨다(= Render는 기존 버전을 계속 서비스, 데이터는 그대로).
import { execSync } from 'child_process';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const MIGRATIONS_DIR = path.join(process.cwd(), 'prisma', 'migrations');
const BASELINE = '0_init';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

// SQL을 문장 단위로 쪼개고 주석·공백 차이를 없애 비교 가능하게 만든다
function statements(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const prisma = new PrismaClient();
const [{ has_migrations: hasMigrations, has_article: hasArticle }] = await prisma.$queryRaw`
  SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS has_migrations,
         to_regclass('public."Article"') IS NOT NULL AS has_article`;
await prisma.$disconnect();

if (!hasMigrations && hasArticle) {
  console.log('[migrate-safe] db push 시절 DB 감지 — baseline 전환 검사 시작');
  const diff = execSync(
    'npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script',
    { encoding: 'utf8' },
  );
  const pending = new Set(
    readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== BASELINE)
      .flatMap((d) => statements(readFileSync(path.join(MIGRATIONS_DIR, d.name, 'migration.sql'), 'utf8'))),
  );
  const unexpected = statements(diff).filter((s) => !pending.has(s));
  if (unexpected.length) {
    console.error('[migrate-safe] DB 구조가 예상(0_init)과 다름 — 안전을 위해 중단합니다. 예상 밖 차이:');
    for (const s of unexpected) console.error('  ' + s);
    process.exit(1);
  }
  run(`npx prisma migrate resolve --applied ${BASELINE}`);
}

// 빈 DB(새 고객사·개발DB 새로 만들기) — 마이그레이션 폴더는 이름순으로 실행되는데 '10_…'이 '1_…'·'9_…'보다 앞에 정렬돼
// 9_photo_bank가 만드는 표를 10_photo_inbox가 먼저 고치려다 실패한다. 그래서 빈 DB는 schema.prisma로 한 번에 만들고
// 모든 마이그레이션을 "적용됨"으로 기록한다 (2026-10-09). 운영 DB(이미 적용된 상태)에는 영향 없음.
if (!hasMigrations && !hasArticle) {
  console.log('[migrate-safe] 빈 DB 감지 — schema.prisma로 전체 생성 후 마이그레이션 기록');
  const sql = execSync('npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script', { encoding: 'utf8' });
  const file = path.join(os.tmpdir(), `ff-init-${Date.now()}.sql`);
  writeFileSync(file, sql);
  run(`npx prisma db execute --file "${file}" --schema prisma/schema.prisma`);
  const names = readdirSync(MIGRATIONS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  for (const name of names) run(`npx prisma migrate resolve --applied ${name}`);
}

run('npx prisma migrate deploy');
