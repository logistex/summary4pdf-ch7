import { describe, expect, it } from 'vitest';
import { statusFor } from '@/lib/errors';
import { errorMessage } from '@/lib/messages';

describe('공용 오류 문구와 상태 코드', () => {
  it('FILE_TOO_LARGE 문구에 파일 크기를 소수 한 자리 MB로 넣는다', () => {
    expect(errorMessage('FILE_TOO_LARGE', { sizeBytes: 5.25 * 1024 * 1024 }))
      .toBe('4MB까지만 올릴 수 있어요. (올린 파일: 5.3MB)');
  });
  it('FILE_TOO_LARGE는 크기를 모르면 괄호 부분을 뺀다', () => {
    expect(errorMessage('FILE_TOO_LARGE')).toBe('4MB까지만 올릴 수 있어요.');
  });
  it('모든 ErrorCode에 한국어 문구가 있다', () => {
    for (const c of ['NOT_PDF','FILE_TOO_LARGE','NO_TEXT','UNREADABLE_PDF','AI_UNAVAILABLE','MULTIPLE_FILES'] as const)
      expect(errorMessage(c)).toMatch(/[가-힣]/);
  });
  it('statusFor는 코드별 HTTP 상태를 준다', () => {
    expect(statusFor('FILE_TOO_LARGE')).toBe(413);
    expect(statusFor('AI_UNAVAILABLE')).toBe(503);
  });
});
