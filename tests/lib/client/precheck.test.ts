import { describe, expect, it } from 'vitest';
import { precheckFiles } from '@/lib/client/precheck';

const pdf = (size = 10, name = 'a.pdf', type = 'application/pdf') =>
  new File([new Uint8Array(size)], name, { type });

describe('precheckFiles', () => {
  it('파일 두 개면 MULTIPLE_FILES', () => {
    expect(precheckFiles([pdf(), pdf()])).toEqual({ code: 'MULTIPLE_FILES' });
  });
  it('PDF 아니면 NOT_PDF', () => {
    expect(precheckFiles([pdf(10, 'a.png', 'image/png')])).toEqual({ code: 'NOT_PDF' });
  });
  it('type이 비어도 .pdf면 통과', () => {
    expect(precheckFiles([pdf(10, 'a.pdf', '')])).toHaveProperty('file');
  });
  it('대문자 .PDF 이름도 통과', () => {
    expect(precheckFiles([pdf(10, 'A.PDF', '')])).toHaveProperty('file');
  });
  it('4MB 정확히는 통과', () => {
    expect(precheckFiles([pdf(4 * 1024 * 1024)])).toHaveProperty('file');
  });
  it('4MB 초과면 FILE_TOO_LARGE와 크기', () => {
    expect(precheckFiles([pdf(4 * 1024 * 1024 + 1)])).toEqual({
      code: 'FILE_TOO_LARGE',
      sizeBytes: 4 * 1024 * 1024 + 1,
    });
  });
});
