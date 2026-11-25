import { describe, expect, it } from 'vitest';
import { parseSummary } from '@/lib/ai/parse';

const ok = {
  oneLine: '광합성의 원리를 설명한다.',
  concepts: [{ name: '광합성', description: '빛을 화학 에너지로 바꾼다.' }],
  definitions: [],
};

describe('parseSummary', () => {
  it('순수 JSON', () => {
    expect(parseSummary(JSON.stringify(ok))).toEqual(ok);
  });
  it('```json 코드 블록과 앞뒤 설명', () => {
    expect(parseSummary('요약입니다:\n```json\n' + JSON.stringify(ok) + '\n```\n끝')).toEqual(ok);
  });
  it('영어 요약은 null', () => {
    expect(parseSummary(JSON.stringify({ ...ok, oneLine: 'Explains photosynthesis.' }))).toBeNull();
  });
  it('oneLine이 비면 null', () => {
    expect(parseSummary(JSON.stringify({ ...ok, oneLine: '  ' }))).toBeNull();
  });
  it('개념 6개면 5개로', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ name: `개념${i}`, description: '설명' }));
    expect(parseSummary(JSON.stringify({ ...ok, concepts: six }))!.concepts).toHaveLength(5);
  });
  it('개념이 0개거나 배열이 아니면 null', () => {
    expect(parseSummary(JSON.stringify({ ...ok, concepts: [] }))).toBeNull();
    expect(parseSummary(JSON.stringify({ ...ok, concepts: 'x' }))).toBeNull();
  });
  it('definitions 없으면 빈 배열', () => {
    const rest: Partial<typeof ok> = { ...ok };
    delete rest.definitions;
    expect(parseSummary(JSON.stringify(rest))!.definitions).toEqual([]);
  });
  it('문자열을 trim한다', () => {
    const r = parseSummary(
      JSON.stringify({
        oneLine: '  가나다  ',
        concepts: [{ name: ' 이름 ', description: ' 설명 ' }],
        definitions: [{ term: ' 용어 ', content: ' 내용 ' }],
      }),
    )!;
    expect(r.oneLine).toBe('가나다');
    expect(r.concepts[0]).toEqual({ name: '이름', description: '설명' });
    expect(r.definitions[0]).toEqual({ term: '용어', content: '내용' });
  });
  it('JSON 아님은 null', () => {
    expect(parseSummary('죄송합니다')).toBeNull();
    expect(parseSummary('{깨진 json}')).toBeNull();
  });
});
