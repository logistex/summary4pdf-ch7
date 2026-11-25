import { describe, expect, it } from 'vitest';
import { validateUpload } from '@/lib/pdf/validate';

/** '%PDF-1.7\n' 뒤를 0으로 채워 정확히 n바이트로 만든다 */
function pdfBytesOfSize(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  bytes.set(new TextEncoder().encode('%PDF-1.7\n'));
  return bytes;
}

describe('validateUpload', () => {
  it('정확히 4MB는 통과', () => {
    expect(() => validateUpload(pdfBytesOfSize(4 * 1024 * 1024))).not.toThrow();
  });
  it('4MB+1바이트는 FILE_TOO_LARGE와 크기', () => {
    expect(() => validateUpload(pdfBytesOfSize(4 * 1024 * 1024 + 1))).toThrow(
      expect.objectContaining({ code: 'FILE_TOO_LARGE', detail: { sizeBytes: 4 * 1024 * 1024 + 1 } }),
    );
  });
  it('확장자만 pdf인 텍스트 파일은 NOT_PDF', () => {
    expect(() => validateUpload(new TextEncoder().encode('hello'))).toThrow(
      expect.objectContaining({ code: 'NOT_PDF' }),
    );
  });
  it('빈 파일은 NOT_PDF', () => {
    expect(() => validateUpload(new Uint8Array())).toThrow(expect.objectContaining({ code: 'NOT_PDF' }));
  });
  it('크기 검사가 먼저: 큰 비PDF는 FILE_TOO_LARGE', () => {
    expect(() => validateUpload(new Uint8Array(4 * 1024 * 1024 + 1))).toThrow(
      expect.objectContaining({ code: 'FILE_TOO_LARGE' }),
    );
  });
});
