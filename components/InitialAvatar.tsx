import { avatarGradientStyle, usableAvatarUrl } from '@/lib/avatarGradient';

export default function InitialAvatar({
  seed,
  name,
  className,
}: {
  seed: string;
  name?: string | null;
  className?: string;
}) {
  const letter = (name || seed).trim().charAt(0);
  return (
    <span className={`initial-avatar ${className ?? ''}`.trim()} style={avatarGradientStyle(seed)} aria-hidden="true">
      {letter}
    </span>
  );
}

export function UserAvatar({
  image,
  seed,
  name,
  className,
}: {
  image?: string | null;
  seed: string;
  name?: string | null;
  className?: string;
}) {
  const src = usableAvatarUrl(image);
  if (src) return <img src={src} alt="" className={className} />;
  return <InitialAvatar seed={seed} name={name} className={className} />;
}
