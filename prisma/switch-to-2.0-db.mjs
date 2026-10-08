// 로컬 .env의 DB 주소를 2.0 DB(오하이오)로 바꾸는 스크립트 — "2.0DB로 전환.bat"이 실행 (2026-10-08)
// 원본: Claude outputs/env.production 의 DATABASE_URL. DIRECT_URL은 같은 주소의 5432 포트(pgbouncer 없음)로 만든다.
// 기존 .env는 .env.before-2.0-switch 로 백업. 다른 값(NEXTAUTH_URL 등)은 그대로 둔다.
import { readFileSync, writeFileSync, copyFileSync } from 'fs';

const src = readFileSync('Claude outputs/env.production', 'utf8');
const dbUrl = src.match(/^DATABASE_URL="?([^"\r\n]+)"?/m)?.[1];
if (!dbUrl || !dbUrl.includes('us-east-2')) {
  console.log('[실패] Claude outputs\\env.production 에서 2.0 DB 주소를 찾지 못했습니다.');
  process.exit(1);
}
const directUrl = dbUrl.replace(':6543/', ':5432/').replace(/[?&]pgbouncer=true/, '');

const envText = readFileSync('.env', 'utf8');
copyFileSync('.env', '.env.before-2.0-switch');
const lines = envText.split(/\r?\n/).filter((l) => !/^(DATABASE_URL|DIRECT_URL)=/.test(l));
lines.unshift(`DATABASE_URL="${dbUrl}"`, `DIRECT_URL="${directUrl}"`);
writeFileSync('.env', lines.join('\n'));

const host = new URL(dbUrl).host;
console.log(`[완료] .env가 2.0 DB(${host})로 바뀌었습니다. 기존 설정은 .env.before-2.0-switch 에 백업했습니다.`);
