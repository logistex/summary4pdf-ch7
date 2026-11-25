'use client';

import { useEffect, useRef, useState } from 'react';
import { requestSummary } from '@/lib/client/api';
import { precheckFiles } from '@/lib/client/precheck';
import { errorMessage, UI_TEXT } from '@/lib/messages';
import type { SummarizeResponse } from '@/lib/types';
import { SummaryView } from './SummaryView';
import { UploadBox } from './UploadBox';

type ViewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; fileName: string; result: Extract<SummarizeResponse, { ok: true }>['result'] }
  | { status: 'error'; message: string };

export function SummaryApp() {
  const [state, setState] = useState<ViewState>({ status: 'idle' });
  // 상태 갱신 전에 연달아 들어오는 요청도 막기 위한 잠금
  const busy = useRef(false);

  // 상자 밖에 파일을 놓으면 브라우저가 그 파일을 열어 앱 화면이 사라지므로 기본 동작을 막는다
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  async function handleFiles(files: File[]) {
    if (busy.current || files.length === 0) return;
    const checked = precheckFiles(files);
    if (!('file' in checked)) {
      setState({ status: 'error', message: errorMessage(checked.code, { sizeBytes: checked.sizeBytes }) });
      return;
    }
    busy.current = true;
    setState({ status: 'loading' });
    try {
      const res = await requestSummary(checked.file);
      setState(
        res.ok
          ? { status: 'success', fileName: res.fileName, result: res.result }
          : { status: 'error', message: res.message },
      );
    } finally {
      busy.current = false;
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-16">
      <h1 className="mb-8 text-center text-2xl font-bold text-slate-900 sm:text-3xl">PDF 요약</h1>

      {state.status === 'loading' && (
        <div role="status" className="flex flex-col items-center gap-4 py-20 text-slate-700">
          <span
            aria-hidden="true"
            className="size-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"
          />
          <p className="text-lg">{UI_TEXT.loading}</p>
        </div>
      )}

      {(state.status === 'idle' || state.status === 'error') && (
        <div className="space-y-4">
          {state.status === 'error' && (
            <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-red-800">
              {state.message}
            </p>
          )}
          <UploadBox onFiles={handleFiles} />
        </div>
      )}

      {state.status === 'success' && (
        <div className="space-y-10">
          <SummaryView fileName={state.fileName} result={state.result} />
          <div className="text-center">
            <button
              type="button"
              onClick={() => setState({ status: 'idle' })}
              className="rounded-lg border border-indigo-600 px-5 py-2.5 font-medium text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              {UI_TEXT.resetButton}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
