'use client';

import { UI_TEXT } from '@/lib/messages';

// 최상위 레이아웃에서 오류가 나도 한국어로 안내한다(자체 <html>/<body> 필요)
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body>
        <main style={{ padding: 24, textAlign: 'center' }}>
          <p role="alert">{UI_TEXT.errorBoundaryMessage}</p>
          <button type="button" onClick={reset}>
            {UI_TEXT.errorBoundaryRetry}
          </button>
        </main>
      </body>
    </html>
  );
}
