import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { ROLES } from '@/lib/roles';
import { CHANNELS, channelReady, getSocialConfig, postNewArticlesToSocial, recentSocialLog, setSocialConfig } from '@/lib/socialPost';

// 관리자 "SNS 자동 게시" — 채널 켜기/끄기와 최근 게시 기록 (편집장 전용, 2026-10-10)
export const dynamic = 'force-dynamic';

async function chief() {
  const u = await getCurrentUser();
  return u?.role === ROLES.CHIEF_EDITOR;
}

export async function GET() {
  if (!(await chief())) return NextResponse.json({ error: '편집장만 볼 수 있습니다' }, { status: 403 });
  const config = await getSocialConfig();
  return NextResponse.json({
    channels: CHANNELS.map((c) => ({ key: c.key, label: c.label, ready: channelReady(c.key), enabled: config[c.key], env: c.env })),
    log: await recentSocialLog(),
  });
}

export async function POST(req: NextRequest) {
  if (!(await chief())) return NextResponse.json({ error: '편집장만 바꿀 수 있습니다' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const cur = await getSocialConfig();
  const next = { x: !!(body.x ?? cur.x), threads: !!(body.threads ?? cur.threads), instagram: !!(body.instagram ?? cur.instagram) };
  await setSocialConfig(next);
  postNewArticlesToSocial().catch(() => {});
  return NextResponse.json({ ok: true, config: next });
}
