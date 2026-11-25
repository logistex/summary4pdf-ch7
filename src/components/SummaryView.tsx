import { UI_TEXT } from '@/lib/messages';
import type { SummaryResult } from '@/lib/types';

interface SummaryViewProps {
  fileName: string;
  result: SummaryResult;
}

/** 요약 결과: 한 줄 요약 → 핵심 개념 → 정의·공식 */
export function SummaryView({ fileName, result }: SummaryViewProps) {
  return (
    <article className="space-y-8">
      <div className="space-y-2">
        <p className="break-all text-sm text-slate-600">{fileName}</p>
        {result.truncated && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {UI_TEXT.truncatedNotice}
          </p>
        )}
      </div>

      <section aria-labelledby="h-one-line">
        <h2 id="h-one-line" className="mb-2 text-sm font-semibold text-indigo-700">
          {UI_TEXT.headingOneLine}
        </h2>
        <p className="wrap-anywhere rounded-2xl bg-indigo-50 p-5 text-xl font-bold leading-relaxed text-slate-900 sm:text-2xl">
          {result.oneLine}
        </p>
      </section>

      <section aria-labelledby="h-concepts">
        <h2 id="h-concepts" className="mb-3 text-lg font-semibold text-slate-900">
          {UI_TEXT.headingConcepts}
        </h2>
        <ul className="space-y-3">
          {result.concepts.map((c, i) => (
            <li key={`${c.name}-${i}`} className="rounded-xl border border-slate-200 p-4">
              <p className="wrap-anywhere font-bold text-slate-900">{c.name}</p>
              <p className="wrap-anywhere mt-1 text-slate-700">{c.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="h-definitions">
        <h2 id="h-definitions" className="mb-3 text-lg font-semibold text-slate-900">
          {UI_TEXT.headingDefinitions}
        </h2>
        {result.definitions.length === 0 ? (
          <p className="text-slate-600">{UI_TEXT.noDefinitions}</p>
        ) : (
          <dl className="space-y-3">
            {result.definitions.map((d, i) => (
              <div key={`${d.term}-${i}`} className="rounded-xl bg-slate-50 p-4">
                <dt className="wrap-anywhere font-bold text-slate-900">{d.term}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-slate-700">{d.content}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </article>
  );
}
