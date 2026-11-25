// 프롬프트와 입력 준비를 한곳에서 관리한다. 문구를 고칠 때는 이 파일만 본다.
import { MAX_INPUT_CHARS } from '../limits';

export type ChatMessage = { role: 'system' | 'user'; content: string };

export const SYSTEM_PROMPT = `너는 대학생의 시험 공부를 돕는 요약 도우미다. 사용자가 준 문서(강의 자료나 논문)를 읽고 반드시 한국어로 요약한다. 원문이 영어여도 모든 출력은 한국어로 쓴다. 전문 용어는 한국어 뒤 괄호에 원어를 적어도 된다.
아래 JSON 하나만 출력한다. 설명, 마크다운, 코드 블록을 붙이지 않는다.
{"oneLine": "문서 전체를 설명하는 한 문장", "concepts": [{"name": "개념 이름", "description": "한두 문장 설명"}], "definitions": [{"term": "정의나 공식의 이름", "content": "정의 문장 또는 공식(일반 글자)과 한국어 설명"}]}
규칙: concepts는 3개 이상 5개 이하. definitions는 문서에 실제로 나온 중요한 정의나 공식만 넣고, 없으면 빈 배열 []. 문서에 없는 내용을 지어내지 않는다.`;

/** 한도보다 길면 앞에서부터 자르고 truncated를 true로 표시한다 */
export function prepareInput(text: string): { input: string; truncated: boolean } {
  if (text.length <= MAX_INPUT_CHARS) return { input: text, truncated: false };
  return { input: text.slice(0, MAX_INPUT_CHARS), truncated: true };
}

export function buildMessages(input: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `다음 문서를 요약해 줘.\n\n<document>\n${input}\n</document>` },
  ];
}
