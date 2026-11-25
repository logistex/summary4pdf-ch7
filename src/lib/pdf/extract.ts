import { extractText, getDocumentProxy } from 'unpdf';
import { AppError } from '@/lib/errors';

/** 글자 없음 판단: 공백 아닌 글자 수가 max(50, 쪽수*20) 미만 */
function minChars(pageCount: number): number {
  return Math.max(50, pageCount * 20);
}

/** PDF에서 텍스트를 꺼낸다. 열기 실패는 UNREADABLE_PDF, 글자 없음은 NO_TEXT */
export async function extractPdfText(bytes: Uint8Array): Promise<{ text: string; pageCount: number }> {
  let text: string;
  let pageCount: number;
  try {
    // unpdf가 버퍼를 분리(detach)하므로 복사본을 넘긴다
    const pdf = await getDocumentProxy(bytes.slice());
    const result = await extractText(pdf, { mergePages: true });
    text = result.text;
    pageCount = result.totalPages;
  } catch {
    // 암호·손상 등 원본 오류는 밖으로 내보내지 않는다
    throw new AppError('UNREADABLE_PDF');
  }
  const nonWhitespace = text.replace(/\s/g, '').length;
  if (nonWhitespace < minChars(pageCount)) {
    throw new AppError('NO_TEXT');
  }
  return { text, pageCount };
}
