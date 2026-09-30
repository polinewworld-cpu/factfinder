'use client';

import CardHeadline from './CardHeadline';
import { toFrenchBrackets } from '@/lib/frenchBrackets';

export default function ArticleHeadline({
  articleId,
  title,
  canEdit,
}: {
  articleId: string;
  title: string;
  canEdit: boolean;
}) {
  return (
    <h1>
      <CardHeadline
        title={toFrenchBrackets(title)}
        canEdit={canEdit}
        patchUrl={`/api/articles/${articleId}`}
        patchField="title"
        ariaLabel="기사 제목"
      />
    </h1>
  );
}
