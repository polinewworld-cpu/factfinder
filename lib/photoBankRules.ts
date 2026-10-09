// 사진 뱅크 규칙 (2026-10-09, 기능정의 v0.1) — 화면과 서버가 같이 쓰는 값·검사.
// 원칙: 출처가 확인된 사진만 들어온다. 통신사·게티 사진은 막는다.

export const SOURCE_TYPES = ['KOGL', 'PARTY', 'PUBLIC_DOMAIN', 'CC', 'OWN', 'AI_RECON', 'AI_GEN'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_LABEL: Record<SourceType, string> = {
  KOGL: '공공누리',
  PARTY: '정당·의원실 배포',
  PUBLIC_DOMAIN: '퍼블릭 도메인',
  CC: 'CC',
  OWN: '자체 촬영',
  AI_RECON: 'AI 재구성',
  AI_GEN: 'AI 생성',
};

// 출처 유형별 라이선스 세부 선택지
export const LICENSE_OPTIONS: Partial<Record<SourceType, string[]>> = {
  KOGL: ['공공누리 0유형', '공공누리 1유형'],
  CC: ['CC0', 'CC BY', 'CC BY-SA'],
  PUBLIC_DOMAIN: ['퍼블릭 도메인', '미국 정부 저작물'],
};

// "촬영자·기관" 칸에 무엇을 적는지 안내
export const PHOTOGRAPHER_HINT: Record<SourceType, string> = {
  KOGL: '기관명 (예: 국방부)',
  PARTY: '의원실·정당 (예: 홍길동 의원실, 국민의힘)',
  PUBLIC_DOMAIN: '기관명 (예: 백악관)',
  CC: '작성자 (예: Jane Doe)',
  OWN: '촬영 기자 (선택)',
  AI_RECON: '(필요 없음)',
  AI_GEN: '(필요 없음)',
};

export const isAiSource = (t: string | null | undefined) => t === 'AI_RECON' || t === 'AI_GEN';

// 크레디트 자동 규칙 — 출처 유형 + 촬영자·기관(+라이선스)으로 만든다. 화면에서 수정 가능.
export function autoCredit(type: SourceType | '' | null | undefined, photographer?: string | null, license?: string | null) {
  const who = (photographer ?? '').trim();
  switch (type) {
    case 'KOGL':
    case 'PUBLIC_DOMAIN':
    case 'PARTY':
      return who ? `사진=${who}` : '';
    case 'CC':
      return who ? `사진=${who}·위키미디어 커먼즈(${license?.trim() || 'CC BY-SA'})` : '';
    case 'OWN':
      return '사진=팩트파인더';
    case 'AI_RECON':
    case 'AI_GEN':
      return '그래픽=팩트파인더';
    default:
      return '';
  }
}

// 저장 차단 — 통신사·게티 표기. 영문 약어는 단어 단위(APEC 같은 말은 통과)
const BLOCKED: { label: string; re: RegExp }[] = [
  { label: '연합뉴스', re: /연합뉴스|연합포토|yonhap/i },
  { label: '뉴시스', re: /뉴시스|newsis/i },
  { label: '뉴스1', re: /뉴스\s?1|news1/i },
  { label: 'AP', re: /\bAP\b|AP통신|AP연합/ },
  { label: '로이터', re: /로이터|reuters/i },
  { label: 'AFP', re: /\bAFP\b/i },
  { label: 'EPA', re: /\bEPA\b/i },
  { label: '게티', re: /게티|getty/i },
];

export function blockedAgency(...texts: (string | null | undefined)[]): string | null {
  const t = texts.filter(Boolean).join(' ');
  return BLOCKED.find((b) => b.re.test(t))?.label ?? null;
}

// 등록 검사 — 출처 유형 필수, 통신사·게티 표기 차단. 문제없으면 null
export function checkPhotoInput(b: { sourceType?: unknown; credit?: unknown; title?: unknown; photographer?: unknown }) {
  if (!b.sourceType || !(SOURCE_TYPES as readonly string[]).includes(String(b.sourceType))) return '출처 유형을 고르세요. 출처가 확인된 사진만 등록할 수 있습니다.';
  const agency = blockedAgency(String(b.credit ?? ''), String(b.title ?? ''), String(b.photographer ?? ''));
  if (agency) return `${agency} 사진은 사진 뱅크에 넣을 수 없습니다 (크레디트·캡션·촬영자에 "${agency}" 표기).`;
  return null;
}

// 기사에 넣을 때 캡션 — "캡션 (크레디트)". AI 사진은 표시를 지울 수 없게 항상 붙임
export function figureCaption(caption: string | null | undefined, credit: string | null | undefined, sourceType?: string | null) {
  const cap = (caption ?? '').trim();
  const parts: string[] = [];
  if (isAiSource(sourceType)) parts.push(sourceType === 'AI_GEN' ? 'AI 생성 이미지' : 'AI 재구성 이미지');
  if (credit?.trim()) parts.push(credit.trim());
  return parts.length ? `${cap}${cap ? ' ' : ''}(${parts.join(' · ')})` : cap;
}

// ── AI 재구성 프롬프트 (이미지 생성은 하지 않고 프롬프트만 제시 — 사장님 결정 2026-10-09) ──
export type ReconOptions = {
  pose: string; // 포즈·손동작 (자유 입력)
  expression: string; // 표정
  background: 'keep' | 'rearrange' | 'remove';
  tone: string; // 톤·조명
};

export const EXPRESSIONS = ['그대로', '옅은 미소', '진지한', '단호한', '밝게 웃는', '생각에 잠긴'];
export const TONES = ['그대로', '밝고 깨끗하게', '차분한 자연광', '대비가 강한 보도사진 톤', '따뜻한 실내 조명'];

const EXPRESSION_EN: Record<string, string> = {
  '옅은 미소': 'a faint, natural smile',
  진지한: 'a serious, composed expression',
  단호한: 'a firm, determined expression',
  '밝게 웃는': 'a bright, open smile',
  '생각에 잠긴': 'a thoughtful, contemplative expression',
};
const TONE_EN: Record<string, string> = {
  '밝고 깨끗하게': 'bright, clean, evenly lit',
  '차분한 자연광': 'soft, calm natural daylight',
  '대비가 강한 보도사진 톤': 'high-contrast press-photo look',
  '따뜻한 실내 조명': 'warm indoor lighting',
};

export function reconPrompt(o: ReconOptions) {
  const lines = [
    'Re-render the attached photo as a photorealistic news photo in our house style.',
    'Camera: rotate to about a 20-degree three-quarter view of the main subject, with a slightly low camera angle (lens a little below eye level, looking up gently).',
    'Keep the main person\'s identity, face, hairstyle, clothing and accessories exactly the same. Do not add or remove people\'s identifying features.',
  ];
  if (o.pose.trim()) lines.push(`Pose and hand gesture: ${o.pose.trim()}.`);
  if (EXPRESSION_EN[o.expression]) lines.push(`Facial expression: ${EXPRESSION_EN[o.expression]}.`);
  if (o.background === 'rearrange') lines.push('Background: keep the same setting, but rearrange the background people naturally so they do not distract from the main subject.');
  if (o.background === 'remove') lines.push('Background: keep the same setting but remove background people.');
  if (TONE_EN[o.tone]) lines.push(`Tone and lighting: ${TONE_EN[o.tone]}.`);
  lines.push('No text, logos, watermarks or captions in the image. Natural skin texture, no beauty filter. Output 3:2 landscape, high resolution.');
  return lines.join('\n');
}
