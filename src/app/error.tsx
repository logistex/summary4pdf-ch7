'use client';

import { UI_TEXT } from '@/lib/messages';

// 화면 안에서 예상 못 한 오류가 나면 보여주는 한국어 안내
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p role="alert">{UI_TEXT.errorBoundaryMessage}</p>
      <button type="button" onClick={reset} className="rounded-md border px-4 py-2">
        {UI_TEXT.errorBoundaryRetry}
      </button>
    </main>
  );
}
