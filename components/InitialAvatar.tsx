import { avatarGradientStyle } from '@/lib/avatarGradient';

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
