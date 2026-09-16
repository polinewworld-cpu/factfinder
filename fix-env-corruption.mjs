import fs from 'fs';

const files = ['.env', '.env.local', '.env.dev'];
const marker = 'NEXTAUTH_URL=http://localhost:3411YOUTUBE_API_KEY=';
const fixed = 'NEXTAUTH_URL=http://localhost:3411\r\nYOUTUBE_API_KEY=';

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf-8');
  if (content.includes(marker)) {
    const newContent = content.split(marker).join(fixed);
    fs.writeFileSync(file, newContent, 'utf-8');
    console.log(`fixed: ${file}`);
  } else {
    console.log(`no fix needed: ${file}`);
  }
}
