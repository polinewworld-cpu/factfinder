import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

function loadDatabaseUrl() {
  const dir = path.dirname(fileURLToPath(import.meta.url)); // .../prisma
  const envPath = path.join(dir, '..', '.env.local');
  let content = fs.readFileSync(envPath, 'utf-8');
  // Windows 메모장 저장 시 붙는 BOM(맨 앞 보이지 않는 문자) 제거
  content = content.replace(/^﻿/, '');

  const match = content.match(/DATABASE_URL\s*=\s*(.+)/);
  if (!match) {
    throw new Error('.env.local 파일에서 DATABASE_URL 줄을 찾지 못함');
  }
  let value = match[1].trim();
  value = value.replace(/\r$/, '');
  value = value.replace(/^["']|["']$/g, ''); // 값이 따옴표로 감싸져 있으면 제거

  process.env.DATABASE_URL = value;
  console.log(
    'DATABASE_URL 읽음 (길이 ' + value.length + '자, 시작: "' + value.slice(0, 15) + '...")'
  );
}

loadDatabaseUrl();

const prisma = new PrismaClient();

async function main() {
  const email = 'polinewworld@gmail.com';
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: 'CHIEF_EDITOR' },
    create: { email, name: email.split('@')[0], role: 'CHIEF_EDITOR' },
  });
  console.log('OK:', user.email, '->', user.role);
}

main()
  .catch((e) => {
    console.error('FAILED:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
