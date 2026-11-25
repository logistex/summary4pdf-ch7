import { describe, expect, it } from 'vitest';
import { buildMessages, prepareInput } from '@/lib/ai/prompt';
import { MAX_INPUT_CHARS } from '@/lib/limits';

describe('prepareInput', () => {
  it('한도 이하면 그대로', () => {
    expect(prepareInput('abc')).toEqual({ input: 'abc', truncated: false });
  });
  it('한도를 넘으면 앞부분만', () => {
    const r = prepareInput('가'.repeat(MAX_INPUT_CHARS + 10));
    expect(r.input.length).toBe(MAX_INPUT_CHARS);
    expect(r.truncated).toBe(true);
  });
  it('정확히 한도면 자르지 않는다', () => {
    expect(prepareInput('a'.repeat(MAX_INPUT_CHARS)).truncated).toBe(false);
  });
});

describe('buildMessages', () => {
  it('system·user 두 메시지, 문서는 document 태그 안에', () => {
    const m = buildMessages('본문');
    expect(m.map((x) => x.role)).toEqual(['system', 'user']);
    expect(m[1].content).toBe('다음 문서를 요약해 줘.\n\n<document>\n본문\n</document>');
    expect(m[0].content).toContain('반드시 한국어로');
  });
});
