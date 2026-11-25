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
  describe('추론 모델 응답', () => {
    const json = JSON.stringify(ok);
    it('앞에 <think> 블록이 있어도 해석한다', () => {
      expect(parseSummary('<think>먼저 {생각}을 해 보자</think>\n' + json)).toEqual(ok);
    });
    it('여는 태그 없이 </think>만 있으면 그 앞까지 버린다', () => {
      expect(parseSummary('추론 중 { 열린 괄호\n</think>\n' + json)).toEqual(ok);
    });
    it('추론 안에 { 가 있어도 JSON 을 찾는다 (think 태그 없음)', () => {
      expect(parseSummary('생각: 형식은 { oneLine, concepts } 이다.\n' + json)).toEqual(ok);
    });
    it('JSON 뒤에 다른 {} 가 붙어도 해석한다', () => {
      expect(parseSummary(json + '\n참고: {추가 설명}')).toEqual(ok);
    });
    it('후보 중 검증을 통과하는 첫 후보를 뒤에서부터 고른다', () => {
      expect(parseSummary('{"oneLine":"x"} ' + json + ' {"a":1}')).toEqual(ok);
    });
  });
  it('개념 설명 과반에 한글이 없으면 null', () => {
    const en = [1, 2, 3].map((i) => ({ name: 'c' + i, description: 'English only ' + i }));
    expect(parseSummary(JSON.stringify({ ...ok, concepts: en }))).toBeNull();
  });
  it('개념 설명 과반에 한글이 있으면 통과', () => {
    const mixed = [
      { name: 'a', description: '한글 설명' },
      { name: 'b', description: '또 다른 한글' },
      { name: 'c', description: 'English only' },
    ];
    expect(parseSummary(JSON.stringify({ ...ok, concepts: mixed }))).not.toBeNull();
  });
});
