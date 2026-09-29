// CJK 겹낫표 《 》 를 프랑스식 기유메 « » 로 바꿈.
// 저장·표시·입력 어디서든 같은 변환을 써서, 예전에 저장된 글과 앞으로 치는 글이 모두 « » 로 보이게 한다.
export function toFrenchBrackets(value: string): string {
  return value
    .replace(/《|&#12298;|&#x300a;/gi, '«')
    .replace(/》|&#12299;|&#x300b;/gi, '»');
}

export function frenchCopy(value: string | null | undefined): string {
  return value ? toFrenchBrackets(value) : value ?? '';
}

export function replaceFrenchBracketsInTree(root: ParentNode | null): void {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const value = node.nodeValue;
    if (!value) continue;
    const next = toFrenchBrackets(value);
    if (next !== value) node.nodeValue = next;
  }
}
