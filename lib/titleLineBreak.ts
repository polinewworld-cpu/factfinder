export function preserveTitleBreaks(stored: string | undefined, incoming: string): string {
  if (!stored) return incoming;
  if (stored.replace(/\n/g, '') === incoming.replace(/\n/g, '')) return stored;
  return incoming;
}
