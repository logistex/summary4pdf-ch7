import path from 'node:path';
import { extractText, getDocumentProxy } from 'unpdf';
import { AppError } from '@/lib/errors';

// 비내장 CID 한국어 폰트용 CMap 위치. unpdf 의 자동 탐색(import.meta.resolve)은 번들된 서버 코드에서
// 실패하므로 직접 지정한다. next.config.ts 의 outputFileTracingIncludes 가 배포 시 이 파일들을 포함한다
// pdf.js 는 끝이 슬래시(/)인 경로를 요구한다(Windows 에서도 동일)
const CMAP_URL = `${path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'cmaps').replaceAll('\\', '/')}/`;

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
    const pdf = await getDocumentProxy(bytes.slice(), { cMapUrl: CMAP_URL, cMapPacked: true });
    try {
      const result = await extractText(pdf, { mergePages: true });
      text = result.text;
      pageCount = result.totalPages;
    } finally {
      // 직접 만든 문서 객체는 unpdf가 정리하지 않으므로 여기서 해제한다
      await pdf.loadingTask.destroy();
    }
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
