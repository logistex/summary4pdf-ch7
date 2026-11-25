// 크기·시간·글자 수 상수와 모델 ID

/** PDF 최대 크기. 4MB 정확히는 허용하고 1바이트라도 넘으면 거절한다 */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
/** 모델에 보낼 최대 글자 수 (응답 시간 때문에 제한) */
export const MAX_INPUT_CHARS = 120_000;

export const PRIMARY_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
export const FALLBACK_MODEL = 'nvidia/nemotron-3.5-super-vl:free';

// Task 4에서 Vercel 함수 시간 한도를 확인한 뒤 조정한다
export const PRIMARY_TIMEOUT_MS = 25_000;
export const FALLBACK_TIMEOUT_MS = 28_000;
