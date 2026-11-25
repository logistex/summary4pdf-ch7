import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { summarize } from '@/lib/ai/summarize';
import {
  FALLBACK_MODEL,
  FALLBACK_TIMEOUT_MS,
  MAX_INPUT_CHARS,
  PRIMARY_MODEL,
  PRIMARY_TIMEOUT_MS,
} from '@/lib/limits';

const ok = {
  oneLine: '광합성의 원리를 설명한다.',
  concepts: [{ name: '광합성', description: '빛을 화학 에너지로 바꾼다.' }],
  definitions: [],
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('summarize', () => {
  it('1차 성공이면 2차를 부르지 않는다', async () => {
    const call = vi.fn().mockResolvedValue(JSON.stringify(ok));
    const r = await summarize('text', { callModel: call, apiKey: 'test' });
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0][0].model).toBe(PRIMARY_MODEL);
    expect(call.mock.calls[0][0].timeoutMs).toBe(PRIMARY_TIMEOUT_MS);
    expect(r).toEqual({ ...ok, truncated: false });
  });
  it('1차가 throw(시간 초과 포함)하면 2차로', async () => {
    const call = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(JSON.stringify(ok));
    await summarize('text', { callModel: call, apiKey: 'test' });
    expect(call.mock.calls[1][0].model).toBe(FALLBACK_MODEL);
    expect(call.mock.calls[1][0].timeoutMs).toBe(FALLBACK_TIMEOUT_MS);
  });
  it('1차 응답이 영어면 2차로', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ ...ok, oneLine: 'Explains photosynthesis.' }))
      .mockResolvedValueOnce(JSON.stringify(ok));
    const r = await summarize('text', { callModel: call, apiKey: 'test' });
    expect(call).toHaveBeenCalledTimes(2);
    expect(r).toEqual({ ...ok, truncated: false });
  });
  it('둘 다 실패하면 AI_UNAVAILABLE', async () => {
    const call = vi.fn().mockRejectedValue(new Error('429'));
    await expect(summarize('text', { callModel: call, apiKey: 'test' })).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
    });
    expect(call).toHaveBeenCalledTimes(2);
  });
  it('API 키가 없으면 호출 없이 AI_UNAVAILABLE', async () => {
    const call = vi.fn();
    await expect(summarize('text', { callModel: call, apiKey: '' })).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
    });
    expect(call).not.toHaveBeenCalled();
  });
  it('긴 입력은 truncated: true', async () => {
    const call = vi.fn().mockResolvedValue(JSON.stringify(ok));
    const r = await summarize('a'.repeat(MAX_INPUT_CHARS + 1), { callModel: call, apiKey: 'test' });
    expect(r.truncated).toBe(true);
  });
  it('로그에 본문·응답을 남기지 않는다', async () => {
    const call = vi.fn().mockRejectedValue(new Error('비밀본문SECRET'));
    await expect(summarize('문서비밀', { callModel: call, apiKey: 'k' })).rejects.toBeTruthy();
    const logged = JSON.stringify((console.warn as unknown as { mock: { calls: unknown[] } }).mock.calls);
    expect(logged).not.toContain('SECRET');
    expect(logged).not.toContain('문서비밀');
  });
});
