// 모델 응답 문자열을 SummaryCore로 해석·검증한다. 맞지 않으면 null.
import type { SummaryCore } from '../types';

const HANGUL = /[가-힣]/;
const MAX_CONCEPTS = 5;

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** 추론 모델이 섞어 보내는 <think>…</think> 구간을 없앤다. 닫는 태그만 있으면 그 앞 전체를 버린다 */
function stripThink(raw: string): string {
  let s = raw.replace(/<think>[\s\S]*?<\/think>/g, '');
  const close = s.lastIndexOf('</think>');
  if (close >= 0) s = s.slice(close + '</think>'.length);
  return s;
}

/** start 위치의 { 와 짝이 맞는 } 의 위치. 문자열 안의 괄호는 무시한다. 없으면 -1 */
function matchingBrace(s: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return i;
  }
  return -1;
}

/** 해석 후보: 처음 { ~ 마지막 } 전체, 그다음 균형 맞는 {…} 들을 뒤에서부터 */
function candidates(s: string): string[] {
  const out: string[] = [];
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first < 0 || last <= first) return out;
  out.push(s.slice(first, last + 1));
  for (let i = s.lastIndexOf('{'); i >= 0; i = s.lastIndexOf('{', i - 1)) {
    const end = matchingBrace(s, i);
    if (end > i) out.push(s.slice(i, end + 1));
    if (i === 0) break;
  }
  return out;
}

function validate(data: unknown): SummaryCore | null {
  if (typeof data !== 'object' || data === null) return null;
  const obj = data as Record<string, unknown>;

  const oneLine = str(obj.oneLine);
  if (!oneLine || !HANGUL.test(oneLine)) return null;

  if (!Array.isArray(obj.concepts)) return null;
  const concepts = obj.concepts
    .map((c) => ({ name: str((c as Record<string, unknown>)?.name), description: str((c as Record<string, unknown>)?.description) }))
    .filter((c) => c.name && c.description)
    .slice(0, MAX_CONCEPTS);
  if (concepts.length === 0) return null;
  // 개념 설명의 과반에 한글이 있어야 한국어 요약으로 본다
  if (concepts.filter((c) => HANGUL.test(c.description)).length * 2 <= concepts.length) return null;

  const definitions = Array.isArray(obj.definitions)
    ? obj.definitions
        .map((d) => ({ term: str((d as Record<string, unknown>)?.term), content: str((d as Record<string, unknown>)?.content) }))
        .filter((d) => d.term && d.content)
    : [];

  return { oneLine, concepts, definitions };
}

export function parseSummary(raw: string): SummaryCore | null {
  for (const cand of candidates(stripThink(raw))) {
    let data: unknown;
    try {
      data = JSON.parse(cand);
    } catch {
      continue;
    }
    const result = validate(data);
    if (result) return result;
  }
  return null;
}
