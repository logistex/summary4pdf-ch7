import type { ErrorCode } from './types';

export interface AppErrorDetail {
  sizeBytes?: number;
}

/** 사용자에게 보여줄 수 있는 오류. code로 문구와 HTTP 상태가 정해진다 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public detail?: AppErrorDetail,
  ) {
    super(code);
    this.name = 'AppError';
  }
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  NOT_PDF: 415,
  FILE_TOO_LARGE: 413,
  NO_TEXT: 422,
  UNREADABLE_PDF: 422,
  AI_UNAVAILABLE: 503,
  MULTIPLE_FILES: 400,
};

export function statusFor(code: ErrorCode): number {
  return STATUS_BY_CODE[code];
}
