import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES, WRITER_ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { SOURCE_TYPES, autoCredit, blockedAgency, type SourceType } from '@/lib/photoBankRules';

// 사진 여러 장 한 번에 캡션(제목) 일괄 수정 / 해시태그 일괄 추가 — 갤러리 모달에서 다중선택 후 일괄 적용,
// 또는 사진을 해시태그 위로 드래그했을 때 사용 (2026-09-12 신설, 갤러리 기능 개편)
// 2026-10-09 사진 뱅크: 드래그로 여러 장 고른 뒤 캡션·출처 유형(+촬영자·기관 → 크레디트 자동) 일괄 지정, DELETE로 일괄 삭제(편집장만).
// 편집장이 아니면 본인이 올린 사진만 대상에 포함됨(그 외 id는 조용히 제외 — 부분 성공을 허용).
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (!(WRITER_ROLES as readonly string[]).includes(user.role)) {
    return NextResponse.json({ error: '기자 이상만 사진을 수정할 수 있습니다' }, { status: 403 });
  }

  const { photoIds, title, addTagNames, sourceType, photographer, license } = await req.json();
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return NextResponse.json({ error: 'photoIds가 필요합니다' }, { status: 400 });
  }
  const hasTitle = typeof title === 'string';
  const hasSource = typeof sourceType === 'string' && sourceType !== '';
  if (hasSource && !(SOURCE_TYPES as readonly string[]).includes(sourceType)) {
    return NextResponse.json({ error: '출처 유형이 올바르지 않습니다' }, { status: 400 });
  }
  const credit = hasSource ? autoCredit(sourceType as SourceType, photographer, license) || null : undefined;
  const agency = blockedAgency(hasTitle ? title : '', credit ?? '', typeof photographer === 'string' ? photographer : '');
  if (agency) return NextResponse.json({ error: `${agency} 표기가 있어 저장할 수 없습니다` }, { status: 400 });

  const targets = await prisma.photo.findMany({
    where: {
      id: { in: photoIds },
      ...(user.role !== ROLES.CHIEF_EDITOR ? { uploaderId: user.id } : {}),
    },
    select: { id: true },
  });
  if (targets.length === 0) return NextResponse.json({ updated: 0 });

  // 상황 태그는 편집장만 새로 만들 수 있음
  let tagNames: string[] = Array.isArray(addTagNames) ? addTagNames.map((t: string) => (t ?? '').trim()).filter(Boolean) : [];
  if (user.role !== ROLES.CHIEF_EDITOR && tagNames.length) {
    tagNames = (await prisma.photoTag.findMany({ where: { name: { in: tagNames } }, select: { name: true } })).map((t) => t.name);
  }

  const updated = await prisma.$transaction(
    targets.map((t) =>
      prisma.photo.update({
        where: { id: t.id },
        data: {
          ...(hasTitle ? { title: title.trim() || null } : {}),
          ...(hasSource
            ? {
                sourceType: sourceType as any,
                photographer: typeof photographer === 'string' ? photographer.trim() || null : undefined,
                license: typeof license === 'string' ? license.trim() || null : undefined,
                credit,
              }
            : {}),
          ...(tagNames.length > 0
            ? { tags: { connectOrCreate: tagNames.map((name) => ({ where: { name }, create: { name } })) } }
            : {}),
        },
      })
    )
  );

  return NextResponse.json({ updated: updated.length });
}

// 여러 장 삭제 — 편집장만 (기사에 이미 들어간 사진 파일은 기사에 그대로 남음)
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) return NextResponse.json({ error: '사진 삭제는 편집장만 할 수 있습니다' }, { status: 403 });
  const { photoIds } = await req.json().catch(() => ({}));
  if (!Array.isArray(photoIds) || photoIds.length === 0) return NextResponse.json({ error: 'photoIds가 필요합니다' }, { status: 400 });
  const r = await prisma.photo.deleteMany({ where: { id: { in: photoIds.map(String) } } });
  return NextResponse.json({ deleted: r.count });
}
