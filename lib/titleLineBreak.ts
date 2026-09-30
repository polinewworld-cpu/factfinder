export function preserveTitleBreaks(stored: string | undefined, incoming: string): string {
  if (!stored) return incoming;
  if (stored.replace(/\n/g, '') === incoming.replace(/\n/g, '')) return stored;
  return incoming;
}

export function titleKey(value: string): string {
  return value.replace(/\s+/g, '');
}

export function withoutTitleBreaks(value: string): string {
  return value.replace(/\n+/g, ' ').replace(/[ \t]+/g, ' ').replace(/ +/g, ' ').trim();
}

export function cardHeadlineText(title: string, cardTitle?: string | null): string {
  if (cardTitle && titleKey(cardTitle) === titleKey(title)) return cardTitle;
  return withoutTitleBreaks(title);
}
