import { MAX_FILE_BYTES } from '@/lib/limits';
import type { ErrorCode } from '@/lib/types';

export type PrecheckResult = { file: File } | { code: ErrorCode; sizeBytes?: number };

/** 서버로 보내기 전에 브라우저에서 먼저 거르는 검사. 0개는 호출부에서 무시한다 */
export function precheckFiles(files: File[]): PrecheckResult {
  if (files.length > 1) return { code: 'MULTIPLE_FILES' };
  const file = files[0];
  // 일부 브라우저는 type을 비워 두므로 이름의 .pdf도 인정한다
  const looksLikePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!looksLikePdf) return { code: 'NOT_PDF' };
  if (file.size > MAX_FILE_BYTES) return { code: 'FILE_TOO_LARGE', sizeBytes: file.size };
  return { file };
}
