import type { AppErrorDetail } from './errors';
import type { ErrorCode } from './types';

const BASE_MESSAGES: Record<Exclude<ErrorCode, 'FILE_TOO_LARGE'>, string> = {
  NOT_PDF: 'PDF 파일만 올릴 수 있어요.',
  NO_TEXT: '글자를 읽을 수 없는 PDF라 요약할 수 없어요. 스캔한 문서는 아직 지원하지 않아요.',
  UNREADABLE_PDF: '이 PDF를 열 수 없어요. 암호가 걸려 있거나 손상된 파일일 수 있어요.',
  AI_UNAVAILABLE: '지금은 요약할 수 없어요. 잠시 후 다시 시도해 주세요.',
  MULTIPLE_FILES: '한 번에 PDF 하나만 올릴 수 있어요.',
};

/** 오류 코드를 화면에 보여줄 한국어 문구로 바꾼다 */
export function errorMessage(code: ErrorCode, detail?: AppErrorDetail): string {
  if (code === 'FILE_TOO_LARGE') {
    if (detail?.sizeBytes === undefined) return '4MB까지만 올릴 수 있어요.';
    const sizeMb = (detail.sizeBytes / 1024 / 1024).toFixed(1);
    return `4MB까지만 올릴 수 있어요. (올린 파일: ${sizeMb}MB)`;
  }
  return BASE_MESSAGES[code];
}

/** 화면에 쓰는 고정 문구. 화면 코드는 여기서만 가져다 쓴다 */
export const UI_TEXT = {
  dropGuide: 'PDF를 여기에 끌어다 놓으세요',
  dropHint: 'PDF, 4MB까지',
  selectFileButton: '파일 선택',
  privacyNotice: '문서 내용은 요약을 위해 외부 AI 서비스로 보내지고, 이 앱에는 저장되지 않아요',
  loading: '요약하는 중이에요',
  noDefinitions: '이 문서에서 찾은 정의나 공식이 없어요',
  truncatedNotice: '문서가 길어 앞부분만 요약했어요',
  resetButton: '다른 PDF 요약하기',
  headingOneLine: '한 줄 요약',
  headingConcepts: '핵심 개념',
  headingDefinitions: '정의·공식',
} as const;
