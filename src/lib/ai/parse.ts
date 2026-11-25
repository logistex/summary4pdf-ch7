// 모델 응답 문자열을 SummaryCore로 해석·검증한다. 맞지 않으면 null.
import type { SummaryCore } from '../types';

const HANGUL = /[가-힣]/;
const MAX_CONCEPTS = 5;

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function parseSummary(raw: string): SummaryCore | null {
  // 코드 블록·앞뒤 설명이 있어도 처음 { 부터 마지막 } 까지만 본다
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  let data: unknown;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
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

  const definitions = Array.isArray(obj.definitions)
    ? obj.definitions
        .map((d) => ({ term: str((d as Record<string, unknown>)?.term), content: str((d as Record<string, unknown>)?.content) }))
        .filter((d) => d.term && d.content)
    : [];

  return { oneLine, concepts, definitions };
}
