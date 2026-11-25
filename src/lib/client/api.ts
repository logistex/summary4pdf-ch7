import { errorMessage } from '@/lib/messages';
import type { SummarizeResponse } from '@/lib/types';

/**
 * PDF를 서버에 보내 요약을 받는다. 어떤 실패도 throw하지 않고 오류 응답 객체로 돌려준다.
 * 서버 처리가 길 수 있어(최대 약 110초) 클라이언트 시간 제한은 두지 않는다.
 */
export async function requestSummary(
  file: File,
  fetchImpl: typeof fetch = fetch,
): Promise<SummarizeResponse> {
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await fetchImpl('/api/summarize', { method: 'POST', body: form });
    const text = await res.text();
    try {
      const parsed = JSON.parse(text) as SummarizeResponse;
      if (parsed && typeof parsed === 'object' && 'ok' in parsed) return parsed;
    } catch {
      // JSON이 아님: 플랫폼이 돌려준 HTML/텍스트 오류(504 등)
    }
    if (res.status === 413) {
      return { ok: false, code: 'FILE_TOO_LARGE', message: errorMessage('FILE_TOO_LARGE') };
    }
    return { ok: false, code: 'AI_UNAVAILABLE', message: errorMessage('AI_UNAVAILABLE') };
  } catch {
    // 네트워크 오류
    return { ok: false, code: 'AI_UNAVAILABLE', message: errorMessage('AI_UNAVAILABLE') };
  }
}
