import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import { MAX_FILE_BYTES } from '@/lib/limits';
import { makeBlankPdf, makeTextPdf } from '../../helpers/pdf';

vi.mock('@/lib/ai/summarize', () => ({ summarize: vi.fn() }));

import { summarize } from '@/lib/ai/summarize';
import { POST } from '@/app/api/summarize/route';

// 글자 없음 기준(50자 이상)을 넘기는 한 줄
const LONG_LINE = 'Hello world text. '.repeat(5);

const okResult = {
  oneLine: '한 줄 요약',
  concepts: [{ name: '개념', description: '설명' }],
  definitions: [],
  truncated: false,
};

function reqWith(file?: File): Request {
  const form = new FormData();
  if (file) form.append('file', file);
  return new Request('http://localhost/api/summarize', { method: 'POST', body: form });
}

function pdfFile(bytes: Uint8Array, name = 'lecture.pdf'): File {
  return new File([bytes as BlobPart], name, { type: 'application/pdf' });
}

beforeEach(() => {
  vi.mocked(summarize).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/summarize', () => {
  it('글자 있는 PDF → 200과 결과, 파일 이름', async () => {
    vi.mocked(summarize).mockResolvedValue(okResult);
    const res = await POST(reqWith(pdfFile(await makeTextPdf([LONG_LINE]))));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      fileName: 'lecture.pdf',
      result: { truncated: false },
    });
  });

  it('file 필드가 없으면 415 NOT_PDF', async () => {
    const res = await POST(reqWith());
    expect(res.status).toBe(415);
    expect(await res.json()).toMatchObject({ ok: false, code: 'NOT_PDF' });
  });

  it('PDF가 아니면 415 NOT_PDF와 한국어 문구', async () => {
    const res = await POST(reqWith(new File(['hello'], 'a.pdf', { type: 'application/pdf' })));
    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({
      ok: false,
      code: 'NOT_PDF',
      message: 'PDF 파일만 올릴 수 있어요.',
    });
  });

  it('4MB 초과면 413 FILE_TOO_LARGE', async () => {
    const big = new Uint8Array(MAX_FILE_BYTES + 1);
    big.set(new TextEncoder().encode('%PDF-1.4'));
    const res = await POST(reqWith(pdfFile(big)));
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ ok: false, code: 'FILE_TOO_LARGE' });
  });

  it('글자 없는 PDF면 422 NO_TEXT, 요약 호출 없음', async () => {
    const res = await POST(reqWith(pdfFile(await makeBlankPdf(2))));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ ok: false, code: 'NO_TEXT' });
    expect(summarize).not.toHaveBeenCalled();
  });

  it('요약 실패면 503 AI_UNAVAILABLE', async () => {
    vi.mocked(summarize).mockRejectedValue(new AppError('AI_UNAVAILABLE'));
    const res = await POST(reqWith(pdfFile(await makeTextPdf([LONG_LINE]))));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, code: 'AI_UNAVAILABLE' });
  });

  it('예상 못 한 오류도 JSON 503 AI_UNAVAILABLE', async () => {
    vi.mocked(summarize).mockRejectedValue(new Error('boom'));
    const res = await POST(reqWith(pdfFile(await makeTextPdf([LONG_LINE]))));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, code: 'AI_UNAVAILABLE' });
  });
});
