// URL 도메인을 보고 SNS 플랫폼을 자동으로 인식 (기능정의서 3.2.1 "SNS 로고 자동 매칭")
export type SnsPlatform = 'instagram' | 'facebook' | 'youtube' | 'x' | 'threads' | 'link';

export function detectSnsPlatform(url: string): SnsPlatform {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'link';
  }
  if (host.includes('instagram.com')) return 'instagram';
  if (host.includes('facebook.com') || host === 'fb.com') return 'facebook';
  if (host.includes('youtube.com') || host === 'youtu.be') return 'youtube';
  if (host === 'x.com' || host.includes('twitter.com')) return 'x';
  if (host.includes('threads.net')) return 'threads';
  return 'link';
}

export const SNS_PLATFORM_LABELS: Record<SnsPlatform, string> = {
  instagram: '인스타그램',
  facebook: '페이스북',
  youtube: '유튜브',
  x: 'X (트위터)',
  threads: '스레드',
  link: '링크',
};
