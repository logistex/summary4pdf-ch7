import { AppError } from '@/lib/errors';
import { MAX_FILE_BYTES } from '@/lib/limits';

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/** 업로드 바이트 검사. 크기를 먼저 보고, 그다음 PDF 시그니처를 본다 */
export function validateUpload(bytes: Uint8Array): void {
  if (bytes.length > MAX_FILE_BYTES) {
    throw new AppError('FILE_TOO_LARGE', { sizeBytes: bytes.length });
  }
  if (bytes.length === 0 || !PDF_SIGNATURE.every((b, i) => bytes[i] === b)) {
    throw new AppError('NOT_PDF');
  }
}
