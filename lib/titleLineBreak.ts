export function preserveTitleBreaks(stored: string | undefined, incoming: string): string {
  if (!stored) return incoming;
  if (stored.replace(/\n/g, '') === incoming.replace(/\n/g, '')) return stored;
  return incoming;
}

export function toggleLineBreak(title: string, index: number): string {
  const i = Math.max(0, Math.min(title.length, Math.round(index)));
  if (i <= 0 || i >= title.length) return title;
  if (title[i] === '\n') return title.slice(0, i) + title.slice(i + 1);
  if (title[i - 1] === '\n') return title.slice(0, i - 1) + title.slice(i);
  return `${title.slice(0, i)}\n${title.slice(i)}`;
}

export function caretOffsetFromPoint(root: HTMLElement, x: number, y: number): number | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  let node: Node | null = null;
  let offset = 0;
  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) {
      node = pos.offsetNode;
      offset = pos.offset;
    }
  } else if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(x, y);
    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }
  if (!node || !root.contains(node)) {
    const rect = root.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
    return root.textContent?.length ?? null;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  while (walker.nextNode()) {
    const current = walker.currentNode as Text;
    const length = current.nodeValue?.length ?? 0;
    if (current === node) return total + Math.min(offset, length);
    total += length;
  }
  if (node.nodeType === Node.ELEMENT_NODE) return total;
  return total;
}
