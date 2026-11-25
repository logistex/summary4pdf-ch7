import { describe, expect, it, vi } from 'vitest';
import { requestSummary } from '@/lib/client/api';
import { errorMessage } from '@/lib/messages';

const pdf = () => new File([new Uint8Array(10)], 'a.pdf', { type: 'application/pdf' });

describe('requestSummary', () => {
  it('JSON 응답은 그대로 돌려준다', async () => {
    const body = { ok: false, code: 'NO_TEXT', message: errorMessage('NO_TEXT') };
    const f = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), { status: 422, headers: { 'content-type': 'application/json' } }),
    );
    expect(await requestSummary(pdf(), f)).toEqual(body);
  });
  it('파일을 file 필드로 POST한다', async () => {
    const f = vi.fn().mockResolvedValue(new Response('{"ok":false,"code":"NOT_PDF","message":"x"}'));
    await requestSummary(pdf(), f);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('/api/summarize');
    expect(init.method).toBe('POST');
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
  });
  it('HTML 504(함수 시간 초과)는 AI_UNAVAILABLE 응답으로', async () => {
    const f = vi.fn().mockResolvedValue(new Response('<html>Gateway Timeout</html>', { status: 504 }));
    expect(await requestSummary(pdf(), f)).toEqual({
      ok: false,
      code: 'AI_UNAVAILABLE',
      message: errorMessage('AI_UNAVAILABLE'),
    });
  });
  it('HTML 413은 FILE_TOO_LARGE로', async () => {
    const f = vi.fn().mockResolvedValue(new Response('Request Entity Too Large', { status: 413 }));
    expect(await requestSummary(pdf(), f)).toEqual({
      ok: false,
      code: 'FILE_TOO_LARGE',
      message: errorMessage('FILE_TOO_LARGE'),
    });
  });
  it('네트워크 오류는 AI_UNAVAILABLE로', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await requestSummary(pdf(), f)).toEqual({
      ok: false,
      code: 'AI_UNAVAILABLE',
      message: errorMessage('AI_UNAVAILABLE'),
    });
  });
});
