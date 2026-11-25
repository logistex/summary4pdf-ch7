# PDF 요약 웹 앱 구현 계획

> **에이전트 작업자용:** 필수 하위 스킬: superpowers:subagent-driven-development(권장) 또는 superpowers:executing-plans로 태스크를 하나씩 구현한다. 단계는 체크박스(`- [ ]`)로 추적한다.
> **담당 에이전트(사용자 지정):** 각 태스크 제목 옆의 `.claude/agents` 에이전트에게 맡긴다.

**목표:** PDF 한 개를 끌어다 놓으면 한 줄 요약·핵심 개념·정의/공식을 한국어로 보여 주는 Next.js 웹 앱을 만들어 깃허브 `summary4pdf-ch7`에 올리고 Vercel에 배포한다.

**구조:** 한 페이지짜리 Next.js(App Router) 앱. 브라우저가 PDF를 `POST /api/summarize`로 보내면 서버가 검사 → `unpdf`로 텍스트 추출 → OpenRouter 1차 모델 호출(실패 시 2차) → JSON 응답을 검증해 돌려준다. 어떤 데이터도 저장하지 않는다.

**기술:** Next.js 16(App Router, TypeScript, Tailwind CSS), `unpdf`(PDF 텍스트 추출), OpenRouter Chat Completions(`fetch`로 직접 호출), Vitest + React Testing Library(jsdom), 시험용 PDF 생성에 `pdf-lib`·`@pdf-lib/fontkit`(개발 의존성).

**설계 문서:** [docs/superpowers/specs/2026-11-25-pdf-summary-design.md](../specs/2026-11-25-pdf-summary-design.md) — 구현자는 이 계획과 설계 문서를 함께 읽는다.

## 전체 제약

- 화면 문구·주석·문서·커밋 메시지는 한국어. 식별자는 영어.
- `.env*` 파일은 열거나 읽거나 출력하지 않는다. 변수 이름 `OPENROUTER_API_KEY`만 쓴다. 키는 서버 코드(`process.env.OPENROUTER_API_KEY`)에서만 읽고, 브라우저로 가는 코드·로그·응답에 절대 넣지 않는다.
- PDF 최대 크기 `MAX_FILE_BYTES = 4 * 1024 * 1024`(4MB 정확히는 허용, 1바이트라도 넘으면 거절). 쪽수 제한 없음. 한 번에 한 파일.
- 1차 모델 `nvidia/nemotron-3-ultra-550b-a55b:free`, 2차 모델 `nvidia/nemotron-3.5-super-vl:free`. (2026-11-25 OpenRouter 모델 목록에서 두 ID 존재 확인. 둘 다 컨텍스트 1M 토큰. 1차는 `response_format` 미지원 → JSON은 프롬프트로 요구하고 직접 해석한다.)
- 올린 PDF·추출 텍스트·요약은 서버 어디에도 저장하지 않는다(파일·DB·캐시 금지). 로그에는 오류 종류와 모델 이름만 남긴다.
- 사용량 제한 장치 없음. 실제 OpenRouter 호출 시험은 전체 합쳐 10회 이내로 아낀다. 나머지는 가짜 `callModel`로 시험한다.
- 배포: Vercel Hobby, **새** 프로젝트. 깃허브 `summary4pdf-ch7` 공개 저장소 새로 생성(`summary4pdf-ch7-v1`은 건드리지 않음). 저장소 생성·푸시·Vercel 작업 전에는 반드시 사용자에게 확인한다.
- 작업 브랜치: `feat/pdf-summary`(현재 `docs/prd` 브랜치에서 분기).

### 정확한 화면 문구 (`src/lib/messages.ts`에 모은다)

| 키 | 문구 |
|----|------|
| `NOT_PDF` | PDF 파일만 올릴 수 있어요. |
| `FILE_TOO_LARGE` | 4MB까지만 올릴 수 있어요. (올린 파일: {size}MB) — `{size}`는 `(bytes / 1024 / 1024).toFixed(1)` |
| `NO_TEXT` | 글자를 읽을 수 없는 PDF라 요약할 수 없어요. 스캔한 문서는 아직 지원하지 않아요. |
| `UNREADABLE_PDF` | 이 PDF를 열 수 없어요. 암호가 걸려 있거나 손상된 파일일 수 있어요. |
| `AI_UNAVAILABLE` | 지금은 요약할 수 없어요. 잠시 후 다시 시도해 주세요. |
| `MULTIPLE_FILES` | 한 번에 PDF 하나만 올릴 수 있어요. |
| 업로드 안내 | PDF를 여기에 끌어다 놓으세요 / PDF, 4MB까지 / 버튼 "파일 선택" |
| 개인정보 안내 | 문서 내용은 요약을 위해 외부 AI 서비스로 보내지고, 이 앱에는 저장되지 않아요 |
| 로딩 | 요약하는 중이에요 |
| 정의·공식 없음 | 이 문서에서 찾은 정의나 공식이 없어요 |
| 잘림 표시 | 문서가 길어 앞부분만 요약했어요 |
| 다시 하기 버튼 | 다른 PDF 요약하기 |
| 결과 제목 | 한 줄 요약 / 핵심 개념 / 정의·공식 |

`UNREADABLE_PDF`(암호·손상 PDF)와 `MULTIPLE_FILES`는 설계 문서에 없던 경우를 계획 단계에서 추가한 것이다.

## 검토 초점

테스트가 직접 다루지 않으면 사용자를 가장 괴롭힐 다섯 가지. 각각 아래 태스크에 시험을 넣었다.

1. **Vercel 함수 시간 초과로 HTML 504가 오는 경우** → 화면에 `AI_UNAVAILABLE` 문구가 떠야 한다(빈 화면·영어 오류 금지). → Task 5 `requestSummary` 시험.
2. **암호가 걸렸거나 깨진 PDF** → 서버가 죽지 않고 `UNREADABLE_PDF`. → Task 2 시험.
3. **모델이 JSON을 ```json 코드 블록이나 앞뒤 설명과 함께 돌려주는 경우** → 정상 해석. 요약이 영어로 오면 실패로 보고 2차 모델로. → Task 3 시험.
4. **파일 여러 개를 한꺼번에 끌어다 놓는 경우** → `MULTIPLE_FILES` 안내, 요청 보내지 않음. → Task 5 시험.
5. **요약 중에 또 파일을 놓는 경우** → 무시(중복 요청 없음). → Task 5 시험.

---

## 파일 구조

```
src/
  app/
    layout.tsx               # lang="ko", 제목·설명 메타데이터
    page.tsx                 # <SummaryApp /> 렌더
    api/summarize/route.ts   # POST 핸들러, maxDuration
  components/
    SummaryApp.tsx           # 상태(idle/loading/success/error) 관리 (client)
    UploadBox.tsx            # 끌어다 놓기 + 파일 선택 (client)
    SummaryView.tsx          # 결과 표시
  lib/
    types.ts                 # 공용 타입
    limits.ts                # 크기·시간·글자 수 상수, 모델 ID
    messages.ts              # 오류 코드 → 문구, 화면 문구
    errors.ts                # AppError, 상태 코드 매핑
    pdf/validate.ts          # 크기·PDF 시그니처 검사
    pdf/extract.ts           # unpdf 텍스트 추출, 글자 없음 판단
    ai/prompt.ts             # 입력 자르기, 메시지 만들기
    ai/openrouter.ts         # OpenRouter 한 번 호출
    ai/parse.ts              # 모델 응답 → SummaryCore 검증
    ai/summarize.ts          # 1차→2차 대체 흐름
    client/precheck.ts       # 브라우저 쪽 사전 검사
    client/api.ts            # fetch + 응답 해석
tests/
  helpers/pdf.ts             # 메모리에서 시험용 PDF 만들기 (pdf-lib)
  (각 모듈별 *.test.ts / *.test.tsx)
scripts/make-sample-pdfs.mjs # QA용 실제 샘플 PDF 생성 (samples/, git 제외)
```

## 공용 인터페이스 (Task 1에서 만든다, 모든 태스크가 사용)

```ts
// src/lib/types.ts
export type ErrorCode =
  | 'NOT_PDF' | 'FILE_TOO_LARGE' | 'NO_TEXT' | 'UNREADABLE_PDF'
  | 'AI_UNAVAILABLE' | 'MULTIPLE_FILES';
export interface Concept { name: string; description: string }
export interface Definition { term: string; content: string }
export interface SummaryCore { oneLine: string; concepts: Concept[]; definitions: Definition[] }
export interface SummaryResult extends SummaryCore { truncated: boolean }
export type SummarizeResponse =
  | { ok: true; fileName: string; result: SummaryResult }
  | { ok: false; code: ErrorCode; message: string };
```

```ts
// src/lib/limits.ts
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_INPUT_CHARS = 120_000;      // 모델에 보낼 최대 글자 수 (응답 시간 때문에 제한)
export const PRIMARY_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
export const FALLBACK_MODEL = 'nvidia/nemotron-3.5-super-vl:free';
export const PRIMARY_TIMEOUT_MS = 25_000;    // Task 4에서 Vercel 한도 확인 후 조정
export const FALLBACK_TIMEOUT_MS = 28_000;
```

```ts
// src/lib/errors.ts
export class AppError extends Error { constructor(public code: ErrorCode, public detail?: { sizeBytes?: number }) }
export function statusFor(code: ErrorCode): number;
// NOT_PDF 415, FILE_TOO_LARGE 413, NO_TEXT 422, UNREADABLE_PDF 422, AI_UNAVAILABLE 503, MULTIPLE_FILES 400

// src/lib/messages.ts
export function errorMessage(code: ErrorCode, detail?: { sizeBytes?: number }): string;
export const UI_TEXT: { /* 위 표의 화면 문구 */ };
```

## 실행 순서

Task 1 → (Task 2, Task 3, Task 5는 서로 의존하지 않아 나란히 가능) → Task 4(2·3 필요) → Task 6(QA, 전체) → Task 7(배포, 사용자 확인 필요).

---

### Task 1: 프로젝트 뼈대와 공용 모듈 — backend-developer

**Files:**
- Create: Next.js 기본 파일(`package.json`, `next.config.ts`, `tsconfig.json`, `src/app/*`, `eslint.config.*`, `postcss.config.*` 등), `vitest.config.ts`, `src/lib/types.ts`, `src/lib/limits.ts`, `src/lib/errors.ts`, `src/lib/messages.ts`
- Modify: `.gitignore`(기존 `.env*`, `.superpowers/` 줄 유지 + `samples/` 추가)
- Test: `tests/lib/messages.test.ts`

**Interfaces:**
- Produces: 위 "공용 인터페이스" 전부. npm 스크립트 `test`(= `vitest run`), `lint`, `build`, `dev`.

- [ ] **Step 1: 브랜치 만들기** — `git switch -c feat/pdf-summary`
- [ ] **Step 2: Next.js 생성** — 저장소 루트에 이미 파일(`CLAUDE.md`, `.claude/`, `docs/`)이 있어 바로 만들면 충돌하므로, 임시 폴더에 만든 뒤 옮긴다.
  Run: `npx create-next-app@latest _scaffold --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --use-npm --disable-git --yes`
  그 뒤 `_scaffold`의 모든 파일(숨김 파일 포함, `.git` 없음)을 루트로 옮기고 `_scaffold` 삭제. `.gitignore`는 둘을 합친다(기존 두 줄 유지).
  Expected: 루트에서 `npm run build` 성공.
- [ ] **Step 3: 테스트 도구 설치** — `npm i unpdf` / `npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom pdf-lib @pdf-lib/fontkit`. `vitest.config.ts`: 기본 환경 `node`, `@/*` 별칭 해석, `tests/**/*.test.{ts,tsx}`. 컴포넌트 시험 파일은 맨 위 `// @vitest-environment jsdom`.
- [ ] **Step 4: 실패하는 시험 작성** — `tests/lib/messages.test.ts`

```ts
it('FILE_TOO_LARGE 문구에 파일 크기를 소수 한 자리 MB로 넣는다', () => {
  expect(errorMessage('FILE_TOO_LARGE', { sizeBytes: 5.25 * 1024 * 1024 }))
    .toBe('4MB까지만 올릴 수 있어요. (올린 파일: 5.3MB)');
});
it('모든 ErrorCode에 한국어 문구가 있다', () => {
  for (const c of ['NOT_PDF','FILE_TOO_LARGE','NO_TEXT','UNREADABLE_PDF','AI_UNAVAILABLE','MULTIPLE_FILES'] as const)
    expect(errorMessage(c)).toMatch(/[가-힣]/);
});
it('statusFor는 코드별 HTTP 상태를 준다', () => {
  expect(statusFor('FILE_TOO_LARGE')).toBe(413);
  expect(statusFor('AI_UNAVAILABLE')).toBe(503);
});
```
- [ ] **Step 5: 실패 확인** — `npm test` → FAIL(모듈 없음)
- [ ] **Step 6: `types.ts`, `limits.ts`, `errors.ts`, `messages.ts` 구현** — 값과 문구는 위 표·인터페이스 그대로. `sizeBytes`가 없으면 `FILE_TOO_LARGE`는 괄호 부분 없이 "4MB까지만 올릴 수 있어요."
- [ ] **Step 7: 통과 확인** — `npm test`, `npm run lint`, `npm run build` 모두 성공
- [ ] **Step 8: 커밋** — `chore: Next.js 프로젝트 뼈대와 공용 타입·문구 추가`

---

### Task 2: PDF 검사와 텍스트 추출 — backend-developer

**Files:**
- Create: `src/lib/pdf/validate.ts`, `src/lib/pdf/extract.ts`, `tests/helpers/pdf.ts`
- Test: `tests/lib/pdf/validate.test.ts`, `tests/lib/pdf/extract.test.ts`

**Interfaces:**
- Consumes: `AppError`, `MAX_FILE_BYTES` (Task 1)
- Produces:
  - `validateUpload(bytes: Uint8Array): void` — 크기 0이거나 `%PDF-`로 시작하지 않으면 `AppError('NOT_PDF')`, `MAX_FILE_BYTES` 초과면 `AppError('FILE_TOO_LARGE', { sizeBytes })`. 크기 검사를 먼저 한다.
  - `extractPdfText(bytes: Uint8Array): Promise<{ text: string; pageCount: number }>` — `unpdf`의 `getDocumentProxy` + `extractText(pdf, { mergePages: true })`. 열기 실패(암호·손상)는 `AppError('UNREADABLE_PDF')`. 공백 아닌 글자 수가 `max(50, pageCount * 20)` 미만이면 `AppError('NO_TEXT')`.
  - 시험 도우미: `makeTextPdf(lines: string[]): Promise<Uint8Array>`(표준 Helvetica, 영어), `makeBlankPdf(pages: number): Promise<Uint8Array>`(사각형만 그린 PDF = 스캔본 대용), `makeEncryptedLikePdf(): Uint8Array`(`%PDF-1.7` 헤더 뒤 쓰레기 바이트 = 손상 PDF)

- [ ] **Step 1: 실패하는 시험 작성**

```ts
// validate.test.ts
it('정확히 4MB는 통과', () => { expect(() => validateUpload(pdfBytesOfSize(4 * 1024 * 1024))).not.toThrow(); });
it('4MB+1바이트는 FILE_TOO_LARGE와 크기', () => {
  expect(() => validateUpload(pdfBytesOfSize(4 * 1024 * 1024 + 1)))
    .toThrow(expect.objectContaining({ code: 'FILE_TOO_LARGE', detail: { sizeBytes: 4 * 1024 * 1024 + 1 } }));
});
it('확장자만 pdf인 텍스트 파일은 NOT_PDF', () => {
  expect(() => validateUpload(new TextEncoder().encode('hello'))).toThrow(expect.objectContaining({ code: 'NOT_PDF' }));
});
it('빈 파일은 NOT_PDF', () => { expect(() => validateUpload(new Uint8Array())).toThrow(expect.objectContaining({ code: 'NOT_PDF' })); });
// pdfBytesOfSize(n): '%PDF-1.7\n' + 나머지 0으로 채운 n바이트 (시험 파일 안 지역 함수)

// extract.test.ts
it('글자 있는 PDF에서 텍스트와 쪽수를 꺼낸다', async () => {
  const r = await extractPdfText(await makeTextPdf(['Photosynthesis converts light energy into chemical energy.', 'E = mc^2']));
  expect(r.text).toContain('Photosynthesis'); expect(r.pageCount).toBe(1);
});
it('글자 없는 PDF는 NO_TEXT', async () => {
  await expect(extractPdfText(await makeBlankPdf(3))).rejects.toMatchObject({ code: 'NO_TEXT' });
});
it('손상된 PDF는 UNREADABLE_PDF (서버가 죽지 않음)', async () => {
  await expect(extractPdfText(makeEncryptedLikePdf())).rejects.toMatchObject({ code: 'UNREADABLE_PDF' });
});
```
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/lib/pdf` → FAIL
- [ ] **Step 3: `tests/helpers/pdf.ts`, `validate.ts`, `extract.ts` 구현** — 위 시그니처대로. `unpdf`에 넘기기 전에 바이트를 복사(`bytes.slice()`)해 원본이 분리(detach)되지 않게 한다.
- [ ] **Step 4: 통과 확인** — `npx vitest run tests/lib/pdf` → PASS
- [ ] **Step 5: 커밋** — `feat: PDF 업로드 검사와 텍스트 추출 추가`

---

### Task 3: OpenRouter 요약과 모델 대체 — ai-integration-specialist

**Files:**
- Create: `src/lib/ai/prompt.ts`, `src/lib/ai/openrouter.ts`, `src/lib/ai/parse.ts`, `src/lib/ai/summarize.ts`
- Test: `tests/lib/ai/prompt.test.ts`, `tests/lib/ai/parse.test.ts`, `tests/lib/ai/summarize.test.ts`

**Interfaces:**
- Consumes: 타입, `limits.ts`, `AppError` (Task 1)
- Produces:
  - `prepareInput(text: string): { input: string; truncated: boolean }` — `MAX_INPUT_CHARS`보다 길면 앞에서부터 자르고 `truncated: true`.
  - `buildMessages(input: string): ChatMessage[]` — `ChatMessage = { role: 'system' | 'user'; content: string }`.
  - `type CallModel = (args: { model: string; messages: ChatMessage[]; timeoutMs: number; apiKey: string }) => Promise<string>` — 성공 시 `choices[0].message.content` 문자열, 그 밖에는 throw.
  - `callOpenRouter: CallModel` — `POST https://openrouter.ai/api/v1/chat/completions`, 헤더 `Authorization: Bearer <apiKey>`, `Content-Type: application/json`, `X-Title: summary4pdf`. 본문 `{ model, messages, temperature: 0.2, reasoning: { effort: 'low', exclude: true } }`. `AbortSignal.timeout(timeoutMs)`. 2xx 아니거나 content가 비면 throw(메시지에 상태 코드만).
  - `parseSummary(raw: string): SummaryCore | null` — 코드 블록(```json … ```)·앞뒤 설명을 걷어내고 처음 `{`부터 마지막 `}`까지 JSON 파싱. 다음이면 `null`: 파싱 실패, `oneLine`이 비었거나 한글이 없음, `concepts`가 배열이 아니거나 0개. `concepts`는 앞 5개만 남긴다(1~2개는 그대로 허용). `definitions` 없으면 `[]`. 각 항목 문자열을 `trim`.
  - `summarize(text: string, deps?: { callModel?: CallModel; apiKey?: string }): Promise<SummaryResult>` — `apiKey` 기본값 `process.env.OPENROUTER_API_KEY`. 키 없으면 바로 `AppError('AI_UNAVAILABLE')`(로그: "OPENROUTER_API_KEY 미설정"). 1차 모델(`PRIMARY_TIMEOUT_MS`) → 호출 실패·시간 초과·`parseSummary`가 `null`이면 2차 모델(`FALLBACK_TIMEOUT_MS`) → 또 실패면 `AppError('AI_UNAVAILABLE')`. 각 실패는 `console.warn`으로 모델 이름과 원인 종류만 남긴다(본문·키 금지).

**프롬프트 (정확한 문구, `buildMessages`):**

system:
```
너는 대학생의 시험 공부를 돕는 요약 도우미다. 사용자가 준 문서(강의 자료나 논문)를 읽고 반드시 한국어로 요약한다. 원문이 영어여도 모든 출력은 한국어로 쓴다. 전문 용어는 한국어 뒤 괄호에 원어를 적어도 된다.
아래 JSON 하나만 출력한다. 설명, 마크다운, 코드 블록을 붙이지 않는다.
{"oneLine": "문서 전체를 설명하는 한 문장", "concepts": [{"name": "개념 이름", "description": "한두 문장 설명"}], "definitions": [{"term": "정의나 공식의 이름", "content": "정의 문장 또는 공식(일반 글자)과 한국어 설명"}]}
규칙: concepts는 3개 이상 5개 이하. definitions는 문서에 실제로 나온 중요한 정의나 공식만 넣고, 없으면 빈 배열 []. 문서에 없는 내용을 지어내지 않는다.
```
user: `다음 문서를 요약해 줘.\n\n<document>\n{input}\n</document>`

- [ ] **Step 1: 실패하는 시험 작성**

```ts
// prompt.test.ts
it('한도 이하면 그대로', () => { expect(prepareInput('abc')).toEqual({ input: 'abc', truncated: false }); });
it('한도를 넘으면 앞부분만', () => {
  const r = prepareInput('가'.repeat(MAX_INPUT_CHARS + 10));
  expect(r.input.length).toBe(MAX_INPUT_CHARS); expect(r.truncated).toBe(true);
});

// parse.test.ts
const ok = { oneLine: '광합성의 원리를 설명한다.', concepts: [{ name: '광합성', description: '빛을 화학 에너지로 바꾼다.' }], definitions: [] };
it('순수 JSON', () => { expect(parseSummary(JSON.stringify(ok))).toEqual(ok); });
it('```json 코드 블록과 앞뒤 설명', () => {
  expect(parseSummary('요약입니다:\n```json\n' + JSON.stringify(ok) + '\n```\n끝')).toEqual(ok);
});
it('영어 요약은 null', () => { expect(parseSummary(JSON.stringify({ ...ok, oneLine: 'Explains photosynthesis.' }))).toBeNull(); });
it('개념 6개면 5개로', () => {
  const six = Array.from({ length: 6 }, (_, i) => ({ name: `개념${i}`, description: '설명' }));
  expect(parseSummary(JSON.stringify({ ...ok, concepts: six }))!.concepts).toHaveLength(5);
});
it('definitions 없으면 빈 배열', () => {
  const { definitions, ...rest } = ok; expect(parseSummary(JSON.stringify(rest))!.definitions).toEqual([]);
});
it('JSON 아님은 null', () => { expect(parseSummary('죄송합니다')).toBeNull(); });

// summarize.test.ts — callModel 가짜 함수로 시험, 실제 호출 없음
it('1차 성공이면 2차를 부르지 않는다', async () => {
  const call = vi.fn().mockResolvedValue(JSON.stringify(ok));
  const r = await summarize('text', { callModel: call, apiKey: 'test' });
  expect(call).toHaveBeenCalledTimes(1); expect(call.mock.calls[0][0].model).toBe(PRIMARY_MODEL);
  expect(r).toEqual({ ...ok, truncated: false });
});
it('1차가 throw(시간 초과 포함)하면 2차로', async () => {
  const call = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(JSON.stringify(ok));
  await summarize('text', { callModel: call, apiKey: 'test' });
  expect(call.mock.calls[1][0].model).toBe(FALLBACK_MODEL);
  expect(call.mock.calls[1][0].timeoutMs).toBe(FALLBACK_TIMEOUT_MS);
});
it('1차 응답이 영어면 2차로', async () => { /* 1차: oneLine 영어, 2차: ok → 2회 호출, 결과 ok */ });
it('둘 다 실패하면 AI_UNAVAILABLE', async () => {
  const call = vi.fn().mockRejectedValue(new Error('429'));
  await expect(summarize('text', { callModel: call, apiKey: 'test' })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
});
it('API 키가 없으면 호출 없이 AI_UNAVAILABLE', async () => {
  const call = vi.fn();
  await expect(summarize('text', { callModel: call, apiKey: '' })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  expect(call).not.toHaveBeenCalled();
});
it('긴 입력은 truncated: true', async () => { /* 'a'.repeat(MAX_INPUT_CHARS+1) → r.truncated === true */ });
```
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/lib/ai` → FAIL
- [ ] **Step 3: 네 파일 구현** — 위 시그니처·프롬프트 그대로.
- [ ] **Step 4: 통과 확인** — `npx vitest run tests/lib/ai` → PASS
- [ ] **Step 5: 실제 호출 한 번 확인(사용자 확인 단계 포함)** — `scripts/try-summarize.mts`(커밋하지 않음, `npx tsx`로 실행)에서 짧은 영어 문단으로 `summarize`를 1회 부른다. 키는 `.env`를 **열지 않고** Node의 `--env-file=.env` 옵션으로만 넣는다: `npm i -D tsx` 후 `node --env-file=.env --import tsx scripts/try-summarize.mts`. 실제 호출은 이 1회만.
  - Expected: 한국어 `oneLine`이 나온다.
  - 두 모델이 모두 404이고 오류에 "data policy"나 "privacy"가 들어 있으면: 멈추고 오케스트레이터에게 보고한다. 오케스트레이터는 사용자에게 OpenRouter 설정(https://openrouter.ai/settings/privacy)에서 무료 모델 사용을 허용해 달라고 요청한다. 401이면 키 문제로 보고한다.
- [ ] **Step 6: 커밋** — `feat: OpenRouter 요약과 1차·2차 모델 대체 추가` (`scripts/try-summarize.mts`는 커밋 제외)

---

### Task 4: 요약 API 라우트 — backend-developer

**Files:**
- Create: `src/app/api/summarize/route.ts`
- Modify: `src/lib/limits.ts`(필요 시 제한 시간 조정)
- Test: `tests/app/api/summarize.test.ts`

**Interfaces:**
- Consumes: `validateUpload`, `extractPdfText`(Task 2), `summarize`(Task 3), `statusFor`, `errorMessage`, `AppError`(Task 1)
- Produces: `POST /api/summarize` — `multipart/form-data`, 필드 이름 `file`. 성공 200 `{ ok: true, fileName, result }`. 실패 `{ ok: false, code, message }` + `statusFor(code)`. `export const runtime = 'nodejs'`, `export const maxDuration = 60`.

- [ ] **Step 1: Vercel Hobby 한도 확인** — Vercel 공식 문서(Functions 의 Duration / Limits)에서 Hobby 요금제의 최대 실행 시간과 요청 본문 한도를 확인한다. 규칙: Hobby 최대 실행 시간이 120초 이상이면 `maxDuration = 120`, `PRIMARY_TIMEOUT_MS = 50_000`, `FALLBACK_TIMEOUT_MS = 55_000`으로 바꾸고, 60초면 기본값(60 / 25_000 / 28_000)을 유지한다. 요청 본문 한도가 4MB보다 작으면 멈추고 보고한다. 확인한 값과 출처 URL을 커밋 메시지 본문에 적는다.
- [ ] **Step 2: 실패하는 시험 작성** — `vi.mock('@/lib/ai/summarize')`로 요약을 가짜로 바꾸고, `tests/helpers/pdf.ts`로 만든 PDF를 `FormData`에 넣어 `POST(new Request('http://localhost/api/summarize', { method: 'POST', body: form }))`를 직접 부른다.

```ts
it('글자 있는 PDF → 200과 결과, 파일 이름', async () => {
  // summarize 가짜가 ok 결과 반환
  const res = await POST(reqWith(new File([await makeTextPdf(['Hello world text'])], 'lecture.pdf', { type: 'application/pdf' })));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, fileName: 'lecture.pdf', result: { truncated: false } });
});
it('file 필드가 없으면 415 NOT_PDF', async () => { /* 빈 FormData → status 415, code 'NOT_PDF' */ });
it('PDF가 아니면 415 NOT_PDF와 한국어 문구', async () => { /* 'hello' 텍스트 → { ok:false, code:'NOT_PDF', message:'PDF 파일만 올릴 수 있어요.' } */ });
it('4MB 초과면 413 FILE_TOO_LARGE', async () => { /* 4MB+1 바이트 */ });
it('글자 없는 PDF면 422 NO_TEXT, 요약 호출 없음', async () => { /* makeBlankPdf → summarize 미호출 */ });
it('요약 실패면 503 AI_UNAVAILABLE', async () => { /* summarize 가짜가 AppError('AI_UNAVAILABLE') throw */ });
it('예상 못 한 오류도 JSON 503 AI_UNAVAILABLE', async () => { /* summarize 가짜가 new Error('boom') throw */ });
```
- [ ] **Step 3: 실패 확인** — `npx vitest run tests/app` → FAIL
- [ ] **Step 4: `route.ts` 구현** — 순서: `formData()` → `file` 꺼내기(없거나 `File` 아니면 `NOT_PDF`) → `new Uint8Array(await file.arrayBuffer())` → `validateUpload` → `extractPdfText` → `summarize(text)` → 응답. `AppError`가 아닌 예외는 `console.error`(메시지만) 후 `AI_UNAVAILABLE`.
- [ ] **Step 5: 통과 확인** — `npm test` 전체 PASS, `npm run build` 성공
- [ ] **Step 6: 커밋** — `feat: 요약 API 라우트 추가`

---

### Task 5: 업로드·결과 화면 — frontend-developer

**Files:**
- Create: `src/components/SummaryApp.tsx`, `src/components/UploadBox.tsx`, `src/components/SummaryView.tsx`, `src/lib/client/precheck.ts`, `src/lib/client/api.ts`
- Modify: `src/app/page.tsx`(기본 내용 전부 교체), `src/app/layout.tsx`(`<html lang="ko">`, title `PDF 요약`, description `강의 자료와 논문 PDF를 한국어로 요약해 드려요`), `src/app/globals.css`(필요 시)
- Test: `tests/lib/client/precheck.test.ts`, `tests/lib/client/api.test.ts`, `tests/components/SummaryApp.test.tsx`

**Interfaces:**
- Consumes: 타입, `MAX_FILE_BYTES`, `errorMessage`, `UI_TEXT`(Task 1). API 모양은 Task 4의 Produces(구현을 기다릴 필요 없음 — 시험은 `fetch`를 가짜로).
- Produces:
  - `precheckFiles(files: File[]): { file: File } | { code: ErrorCode; sizeBytes?: number }` — 0개는 무시하도록 호출부에서 처리. 2개 이상 `MULTIPLE_FILES`. `type !== 'application/pdf'`이고 이름이 `.pdf`로 끝나지 않으면 `NOT_PDF`. 크기 초과면 `FILE_TOO_LARGE`.
  - `requestSummary(file: File, fetchImpl = fetch): Promise<SummarizeResponse>` — `FormData`에 `file`로 담아 POST. JSON이면 그대로 반환. JSON이 아니면: 상태 413 → `FILE_TOO_LARGE`, 그 밖(504 등)·네트워크 오류 → `AI_UNAVAILABLE` 응답 객체(문구 포함)로 바꿔 반환(throw하지 않음).
  - `<SummaryApp />` — 상태 `idle | loading | success | error`. `idle`·`error`: `UploadBox` 표시(오류면 그 위에 문구). `loading`: 로딩 문구만(업로드 상자 숨김 → 중복 요청 불가). `success`: `SummaryView` + "다른 PDF 요약하기" 버튼(→ `idle`).
  - `<UploadBox onFiles={(files: File[]) => void} />` — 끌어다 놓기 영역 + 숨긴 `<input type="file" accept="application/pdf,.pdf">` + "파일 선택" 버튼. 끌어다 놓는 중에는 테두리 강조. 개인정보 안내 문구를 상자 아래 작은 글씨로.
  - `<SummaryView fileName result />` — 순서: 파일 이름 → (잘렸으면) 잘림 표시 → **한 줄 요약**(가장 큰 글씨, 강조 배경) → **핵심 개념** 카드(이름 굵게 + 설명) → **정의·공식** 목록(`term` 굵게, `content`는 `whitespace-pre-wrap`; 0개면 "이 문서에서 찾은 정의나 공식이 없어요").
- 디자인: 깔끔하고 차분하게. 흰 배경, 가운데 정렬 최대 폭 약 `max-w-2xl`, 넉넉한 여백, 한 가지 강조색. 휴대폰 폭(375px)에서 가로 스크롤 없음. 버튼·입력에 키보드 포커스 표시, 오류 문구는 `role="alert"`, 로딩은 `role="status"`. 세부는 frontend-developer 판단.

- [ ] **Step 1: 실패하는 시험 작성**

```ts
// precheck.test.ts
const pdf = (size = 10, name = 'a.pdf', type = 'application/pdf') => new File([new Uint8Array(size)], name, { type });
it('파일 두 개면 MULTIPLE_FILES', () => { expect(precheckFiles([pdf(), pdf()])).toEqual({ code: 'MULTIPLE_FILES' }); });
it('PDF 아니면 NOT_PDF', () => { expect(precheckFiles([pdf(10, 'a.png', 'image/png')])).toEqual({ code: 'NOT_PDF' }); });
it('type이 비어도 .pdf면 통과', () => { expect(precheckFiles([pdf(10, 'a.pdf', '')])).toHaveProperty('file'); });
it('4MB 초과면 FILE_TOO_LARGE와 크기', () => {
  expect(precheckFiles([pdf(4 * 1024 * 1024 + 1)])).toEqual({ code: 'FILE_TOO_LARGE', sizeBytes: 4 * 1024 * 1024 + 1 });
});

// api.test.ts
it('HTML 504(함수 시간 초과)는 AI_UNAVAILABLE 응답으로', async () => {
  const f = vi.fn().mockResolvedValue(new Response('<html>Gateway Timeout</html>', { status: 504 }));
  expect(await requestSummary(pdf(), f)).toEqual({ ok: false, code: 'AI_UNAVAILABLE', message: errorMessage('AI_UNAVAILABLE') });
});
it('HTML 413은 FILE_TOO_LARGE로', async () => { /* status 413, 본문 텍스트 → code FILE_TOO_LARGE */ });
it('네트워크 오류는 AI_UNAVAILABLE로', async () => { /* fetch가 reject */ });

// SummaryApp.test.tsx (jsdom, fetch 가짜)
it('PDF를 놓으면 로딩 후 한 줄 요약·개념·정의를 보여 준다', async () => { /* drop → '요약하는 중이에요' → oneLine 텍스트, 개념 이름들, 정의 term 표시 */ });
it('정의가 0개면 없음 문구', async () => { /* definitions: [] → '이 문서에서 찾은 정의나 공식이 없어요' */ });
it('truncated면 잘림 표시', async () => { /* '문서가 길어 앞부분만 요약했어요' */ });
it('두 파일을 놓으면 MULTIPLE_FILES 문구, fetch 미호출', async () => {});
it('로딩 중에는 업로드 상자가 없어 다시 놓을 수 없다', async () => { /* fetch를 끝나지 않는 Promise로 → 업로드 영역 queryByText('PDF를 여기에 끌어다 놓으세요') null, fetch 1회 */ });
it('서버 오류 응답이면 그 문구를 role=alert로', async () => { /* { ok:false, code:'NO_TEXT', message } → getByRole('alert') 문구 */ });
it('다른 PDF 요약하기를 누르면 처음 화면', async () => {});
it('파일 선택 버튼으로도 올릴 수 있다', async () => { /* userEvent.upload(input, file) */ });
```
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/lib/client tests/components` → FAIL
- [ ] **Step 3: `precheck.ts`, `api.ts`, 세 컴포넌트, `page.tsx`, `layout.tsx` 구현**
- [ ] **Step 4: 통과 확인** — `npm test` 전체 PASS, `npm run lint`, `npm run build` 성공
- [ ] **Step 5: 커밋** — `feat: 끌어다 놓기 업로드와 요약 결과 화면 추가`

---

### Task 6: 통합 시험과 수정 반복 — qa-engineer (+ 수정은 각 담당 에이전트)

**Files:**
- Create: `scripts/make-sample-pdfs.mjs`(backend-developer가 Step 1에서 작성, 커밋함), `samples/`(생성물, git 제외)

- [ ] **Step 1: 샘플 PDF 만들기 (backend-developer)** — `scripts/make-sample-pdfs.mjs`가 `samples/`에 만든다: `en-paper.pdf`(영어 논문 형식 2~3쪽, 정의 1개·공식 1개 포함), `ko-lecture.pdf`(한국어 강의 자료 2쪽, 글꼴 `C:/Windows/Fonts/malgun.ttf`를 `@pdf-lib/fontkit`로 포함 — 글꼴이 없으면 이 파일만 건너뛰고 알림), `no-defs.pdf`(정의·공식 없는 짧은 영어 수필), `near-4mb.pdf`(글자 있는 PDF + 뒤에 채움 바이트로 약 3.9MB), `over-4mb.pdf`(약 4.2MB), `fake.pdf`(텍스트 파일), `scan.pdf`(도형만 있는 3쪽), `broken.pdf`(헤더만 맞고 손상). 실행: `node scripts/make-sample-pdfs.mjs`.
- [ ] **Step 2: 자동 검사 (qa-engineer)** — `npm test`, `npm run lint`, `npm run build` 모두 통과.
- [ ] **Step 3: 서버 실제 시험 (qa-engineer)** — `npm run dev`를 백그라운드로 띄우고(`.env`는 Next.js가 스스로 읽는다, 직접 열지 않음) `curl -s -F file=@samples/<name> http://localhost:3000/api/summarize`로 확인. 실제 모델 호출은 `en-paper`, `ko-lecture`, `no-defs`, `near-4mb` 네 번만.
  - `en-paper`·`ko-lecture`: 200, `oneLine` 한국어, `concepts` 3~5개, `definitions` 1개 이상
  - `no-defs`: 200, `definitions` `[]`
  - `near-4mb`: 200
  - `over-4mb` 413, `fake` 415, `scan` 422 `NO_TEXT`, `broken` 422 `UNREADABLE_PDF` — 모두 한국어 `message`
  - 서버 로그에 API 키·문서 본문이 찍히지 않았는지 확인
- [ ] **Step 4: 2차 모델 대체 확인 (qa-engineer)** — 대체 흐름은 Task 3 단위 시험(`summarize.test.ts`)이 통과하는지로 확인한다(실제 호출 횟수를 아끼기 위해 일부러 1차를 실패시키지 않는다). Step 3 서버 로그에 1차 실패 → 2차 성공 경고가 있었으면 그 사례를 보고서에 적는다.
- [ ] **Step 5: 화면 확인 (오케스트레이터가 내장 브라우저로)** — `http://localhost:3000`에서 `en-paper.pdf` 업로드 → 결과 화면, 오류 화면 1개(`fake.pdf`), 휴대폰 폭(375×812)에서 가로 스크롤 없음·버튼 누르기 쉬움을 확인하고 스크린샷을 남긴다.
- [ ] **Step 6: 수정 반복** — qa-engineer는 문제마다 "재현 방법 / 기대 / 실제 / 의심 파일"을 보고한다. 오케스트레이터가 담당 에이전트(서버·PDF → backend-developer, AI → ai-integration-specialist, 화면 → frontend-developer)에게 수정을 맡기고, 수정마다 실패를 재현하는 시험을 먼저 추가한다. 고친 뒤 qa-engineer가 해당 시나리오와 `npm test`를 다시 돌린다. 문제가 없어질 때까지 반복.
- [ ] **Step 7: 커밋** — `test: 샘플 PDF 생성 스크립트와 QA 수정 반영`

---

### Task 7: 깃허브 저장소와 Vercel 배포 — 오케스트레이터 + 사용자

모든 단계가 외부에 공개되는 작업이므로 **각 단계 전에 사용자 확인**을 받는다.

- [ ] **Step 1: main에 합치기 (사용자 확인 후)** — `docs/prd`, `feat/pdf-summary`를 `main`에 합친다.
- [ ] **Step 2: 저장소 생성·푸시 (사용자 확인 후)** — 커밋 대상에 `.env*`·`samples/`가 없는지 `git ls-files`로 확인한 뒤 `gh repo create summary4pdf-ch7 --public --source . --remote origin --push`. (이 이름은 지금 `-v1`로 가는 연결이므로, 새로 만들면 그 연결은 끊긴다.)
- [ ] **Step 3: Vercel 새 프로젝트 (사용자가 직접)** — Vercel 대시보드에서 Add New → Project → `summary4pdf-ch7` 가져오기 → 환경 변수 `OPENROUTER_API_KEY` 값 입력(사용자만) → Deploy. 프로젝트 이름이 기존 것과 겹치면 다른 이름(예: `summary4pdf-ch7-next`)을 쓴다.
- [ ] **Step 4: 배포 확인 (qa-engineer)** — 배포 주소에 `en-paper.pdf` 1회, `fake.pdf` 1회 요청해 결과 확인. 시간 초과가 나면 Task 4 Step 1의 한도 값을 다시 본다.
- [ ] **Step 5: 마무리** — 배포 주소를 README(한국어, 사용법·환경 변수 이름·배포 방법)에 적고 커밋·푸시(사용자 확인 후).
