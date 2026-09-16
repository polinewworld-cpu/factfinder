import { NextResponse } from 'next/server';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { isYoutubeConfigured, syncVideoCards } from '@/lib/youtube';

// 편집장이 수동으로 새로고침 — 실서비스 배포 전까지는 주기적 자동수집(cron) 인프라가 없어 수동 트리거로 대체 (기능정의서 4.2.1 warning 2)
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 새로고침할 수 있습니다' }, { status: 403 });
  }

  if (!isYoutubeConfigured()) {
    return NextResponse.json(
      { error: 'YOUTUBE_API_KEY 환경변수가 설정되어 있지 않습니다' },
      { status: 400 }
    );
  }

  try {
    const result = await syncVideoCards();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? '동기화에 실패했습니다' }, { status: 500 });
  }
}
