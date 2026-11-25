// 1차 모델 → 실패하면 2차 모델 순서로 요약한다. 문서·응답·키는 로그에 남기지 않는다.
import { AppError } from '../errors';
import {
  FALLBACK_MODEL,
  FALLBACK_TIMEOUT_MS,
  PRIMARY_MODEL,
  PRIMARY_TIMEOUT_MS,
} from '../limits';
import type { SummaryResult } from '../types';
import { callOpenRouter, type CallModel } from './openrouter';
import { parseSummary } from './parse';
import { buildMessages, prepareInput } from './prompt';

export interface SummarizeDeps {
  callModel?: CallModel;
  apiKey?: string;
}

/** callOpenRouter가 만든 종류 문자열만 통과시키고, 그 밖의 메시지는 "error"로 가린다 */
function failureKind(e: unknown): string {
  const m = e instanceof Error ? e.message : '';
  return /^(timeout|network|parse|empty|http \d{3})$/.test(m) ? m : 'error';
}

export async function summarize(text: string, deps: SummarizeDeps = {}): Promise<SummaryResult> {
  const callModel = deps.callModel ?? callOpenRouter;
  const apiKey = deps.apiKey ?? process.env.OPENROUTER_API_KEY ?? '';
  if (!apiKey) {
    console.warn('OPENROUTER_API_KEY 미설정');
    throw new AppError('AI_UNAVAILABLE');
  }

  const { input, truncated } = prepareInput(text);
  const messages = buildMessages(input);
  const attempts = [
    { model: PRIMARY_MODEL, timeoutMs: PRIMARY_TIMEOUT_MS },
    { model: FALLBACK_MODEL, timeoutMs: FALLBACK_TIMEOUT_MS },
  ];

  for (const { model, timeoutMs } of attempts) {
    try {
      const raw = await callModel({ model, messages, timeoutMs, apiKey });
      const core = parseSummary(raw);
      if (core) return { ...core, truncated };
      console.warn(`[summarize] ${model} 실패: 응답 형식 오류`);
    } catch (e) {
      console.warn(`[summarize] ${model} 실패: ${failureKind(e)}`);
    }
  }
  throw new AppError('AI_UNAVAILABLE');
}
