'use client';

import { useRef, useState } from 'react';
import { UI_TEXT } from '@/lib/messages';

interface UploadBoxProps {
  onFiles: (files: File[]) => void;
}

/** 끌어다 놓기 영역과 파일 선택 버튼 */
export function UploadBox({ onFiles }: UploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div>
      <div
        data-dropzone
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length > 0) onFiles(files);
        }}
        className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
          dragging ? 'border-indigo-600 bg-indigo-50' : 'border-slate-300 bg-white'
        }`}
      >
        <p className="text-lg font-semibold text-slate-900">{UI_TEXT.dropGuide}</p>
        <p className="text-sm text-slate-600">{UI_TEXT.dropHint}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          {UI_TEXT.selectFileButton}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            // 같은 파일을 다시 고를 수 있도록 값을 비운다
            e.target.value = '';
            if (files.length > 0) onFiles(files);
          }}
        />
      </div>
      <p className="mt-3 text-center text-xs text-slate-600">{UI_TEXT.privacyNotice}</p>
    </div>
  );
}
