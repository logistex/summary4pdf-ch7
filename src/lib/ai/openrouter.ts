// OpenRouter(OpenAI 호환) 채팅 API를 한 번 호출한다. 서버에서만 쓴다.
import type { ChatMessage } from './prompt';

export type CallModel = (args: {
  model: string;
  messages: ChatMessage[];
  timeoutMs: number;
  apiKey: string;
}) => Promise<string>;

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/** 성공하면 choices[0].message.content를 돌려주고, 그 밖에는 throw한다. 오류 메시지에는 종류만 담는다 */
export const callOpenRouter: CallModel = async ({ model, messages, timeoutMs, apiKey }) => {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'summary4pdf',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        reasoning: { effort: 'low', exclude: true },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const name = (e as { name?: string }).name;
    throw new Error(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network');
  }
  if (!res.ok) throw new Error(`http ${res.status}`);

  let content: unknown;
  try {
    const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    content = data.choices?.[0]?.message?.content;
  } catch {
    throw new Error('parse');
  }
  if (typeof content !== 'string' || content.trim() === '') throw new Error('empty');
  return content;
};
