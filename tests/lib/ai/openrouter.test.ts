import { afterEach, describe, expect, it, vi } from 'vitest';
import { callOpenRouter } from '@/lib/ai/openrouter';

const KEY = 'sk-or-test-SECRET-123';
const messages = [
  { role: 'system' as const, content: 'sys' },
  { role: 'user' as const, content: 'hi' },
];
const args = { model: 'm/x:free', messages, timeoutMs: 1000, apiKey: KEY };

function stubFetch(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}
const okBody = (content: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe('callOpenRouter', () => {
  it('URL, 헤더, 본문 모양이 맞다', async () => {
    const fn = stubFetch(async () => okBody('안녕'));
    await expect(callOpenRouter(args)).resolves.toBe('안녕');
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'X-Title': 'summary4pdf',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'm/x:free',
      messages,
      temperature: 0.2,
      reasoning: { effort: 'low', exclude: true },
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('시간 초과는 timeout', async () => {
    stubFetch(async () => {
      throw Object.assign(new Error(`aborted ${KEY}`), { name: 'TimeoutError' });
    });
    await expect(callOpenRouter(args)).rejects.toThrow('timeout');
  });

  it('네트워크 오류는 network 이고 키가 새지 않는다', async () => {
    stubFetch(async () => {
      throw new TypeError(`fetch failed for ${KEY}`);
    });
    const err = await callOpenRouter(args).catch((e: Error) => e);
    expect((err as Error).message).toBe('network');
  });

  it('2xx 가 아니면 http N', async () => {
    stubFetch(async () => new Response(`body ${KEY}`, { status: 429 }));
    const err = (await callOpenRouter(args).catch((e: Error) => e)) as Error;
    expect(err.message).toBe('http 429');
    expect(err.message).not.toContain(KEY);
  });

  it.each([null, '', '   '])('content 가 %j 이면 empty', async (content) => {
    stubFetch(async () => okBody(content));
    await expect(callOpenRouter(args)).rejects.toThrow('empty');
  });

  it('choices 가 없어도 empty', async () => {
    stubFetch(async () => new Response('{}', { status: 200 }));
    await expect(callOpenRouter(args)).rejects.toThrow('empty');
  });

  it('본문이 JSON 이 아니면 parse', async () => {
    stubFetch(async () => new Response('<html>not json</html>', { status: 200 }));
    await expect(callOpenRouter(args)).rejects.toThrow('parse');
  });
});
