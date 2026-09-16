import { detectSnsPlatform, SNS_PLATFORM_LABELS } from '@/lib/sns';
import { InstagramIcon, FacebookIcon, YoutubeIcon, XIcon, ThreadsIcon, LinkIcon } from './icons';

const PLATFORM_ICON = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  youtube: YoutubeIcon,
  x: XIcon,
  threads: ThreadsIcon,
  link: LinkIcon,
};

// 기자 프로필 하단에 노출되는 SNS 아이콘 목록 (기능정의서 3.2.1) — 클릭 시 해당 SNS로 이동
export default function SnsLinks({ links }: { links: { url: string }[] }) {
  if (!links || links.length === 0) return null;
  return (
    <span className="sns-links" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {links.map((link) => {
        const platform = detectSnsPlatform(link.url);
        const Icon = PLATFORM_ICON[platform];
        return (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            title={SNS_PLATFORM_LABELS[platform]}
            aria-label={SNS_PLATFORM_LABELS[platform]}
            className="icon-badge icon-badge--sm"
          >
            <Icon />
          </a>
        );
      })}
    </span>
  );
}
