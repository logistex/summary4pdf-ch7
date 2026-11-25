// 서버와 화면이 함께 쓰는 공용 타입

export type ErrorCode =
  | 'NOT_PDF'
  | 'FILE_TOO_LARGE'
  | 'NO_TEXT'
  | 'UNREADABLE_PDF'
  | 'AI_UNAVAILABLE'
  | 'MULTIPLE_FILES';

export interface Concept {
  name: string;
  description: string;
}

export interface Definition {
  term: string;
  content: string;
}

/** 모델이 돌려주는 요약 본문 */
export interface SummaryCore {
  oneLine: string;
  concepts: Concept[];
  definitions: Definition[];
}

/** 화면에 보여줄 요약 결과. truncated는 긴 문서를 앞부분만 요약했다는 표시 */
export interface SummaryResult extends SummaryCore {
  truncated: boolean;
}

export type SummarizeResponse =
  | { ok: true; fileName: string; result: SummaryResult }
  | { ok: false; code: ErrorCode; message: string };
