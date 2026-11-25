// PDF 업로드 → 검사 → 글자 추출 → 요약. 파일·텍스트·요약은 어디에도 저장하지 않는다.
import { summarize } from '@/lib/ai/summarize';
import { AppError, statusFor } from '@/lib/errors';
import { errorMessage } from '@/lib/messages';
import { extractPdfText } from '@/lib/pdf/extract';
import { validateUpload } from '@/lib/pdf/validate';
import type { SummarizeResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

function failure(error: AppError): Response {
  const body: SummarizeResponse = {
    ok: false,
    code: error.code,
    message: errorMessage(error.code, error.detail),
  };
  return Response.json(body, { status: statusFor(error.code) });
}

export async function POST(request: Request): Promise<Response> {
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new AppError('NOT_PDF');
    }
    const file = form.get('file');
    if (!(file instanceof File)) throw new AppError('NOT_PDF');

    const bytes = new Uint8Array(await file.arrayBuffer());
    validateUpload(bytes);
    const { text } = await extractPdfText(bytes);
    const result = await summarize(text);

    const body: SummarizeResponse = { ok: true, fileName: file.name, result };
    return Response.json(body);
  } catch (e) {
    if (e instanceof AppError) return failure(e);
    // 문서 내용이 섞일 수 있으므로 메시지만 남긴다
    console.error('요약 API 예상 못 한 오류:', e instanceof Error ? e.message : 'unknown');
    return failure(new AppError('AI_UNAVAILABLE'));
  }
}
