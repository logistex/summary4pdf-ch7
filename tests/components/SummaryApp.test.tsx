// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SummaryApp } from '@/components/SummaryApp';
import type { SummarizeResponse } from '@/lib/types';

const pdf = (name = 'lecture.pdf') => new File([new Uint8Array(10)], name, { type: 'application/pdf' });

const okResponse = (
  over: Partial<{ definitions: { term: string; content: string }[]; truncated: boolean }> = {},
): SummarizeResponse => ({
  ok: true,
  fileName: 'lecture.pdf',
  result: {
    oneLine: '이 문서는 선형대수의 기초를 다룬다',
    concepts: [
      { name: '벡터', description: '크기와 방향을 가진 양' },
      { name: '행렬', description: '수를 직사각형으로 배열한 것' },
    ],
    definitions: [{ term: '내적', content: 'a·b = Σ aᵢbᵢ' }],
    truncated: false,
    ...over,
  },
});

const jsonResponse = (body: SummarizeResponse) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

// jsdom에는 DataTransfer가 없어 files만 가진 가짜 객체를 넘긴다
const dropOn = (files: File[]) => {
  const zone = screen.getByText('PDF를 여기에 끌어다 놓으세요').closest('[data-dropzone]') as HTMLElement;
  fireEvent.drop(zone, { dataTransfer: { files } });
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SummaryApp', () => {
  it('PDF를 놓으면 로딩 후 한 줄 요약·개념·정의를 보여 준다', async () => {
    fetchMock.mockResolvedValue(jsonResponse(okResponse()));
    render(<SummaryApp />);
    dropOn([pdf()]);
    expect(await screen.findByText('요약하는 중이에요')).toBeTruthy();
    expect(await screen.findByText('이 문서는 선형대수의 기초를 다룬다')).toBeTruthy();
    expect(screen.getByText('벡터')).toBeTruthy();
    expect(screen.getByText('행렬')).toBeTruthy();
    expect(screen.getByText('내적')).toBeTruthy();
    expect(screen.getByText('lecture.pdf')).toBeTruthy();
  });

  it('정의가 0개면 없음 문구', async () => {
    fetchMock.mockResolvedValue(jsonResponse(okResponse({ definitions: [] })));
    render(<SummaryApp />);
    dropOn([pdf()]);
    expect(await screen.findByText('이 문서에서 찾은 정의나 공식이 없어요')).toBeTruthy();
  });

  it('truncated면 잘림 표시', async () => {
    fetchMock.mockResolvedValue(jsonResponse(okResponse({ truncated: true })));
    render(<SummaryApp />);
    dropOn([pdf()]);
    expect(await screen.findByText('문서가 길어 앞부분만 요약했어요')).toBeTruthy();
  });

  it('truncated가 아니면 잘림 표시 없음', async () => {
    fetchMock.mockResolvedValue(jsonResponse(okResponse()));
    render(<SummaryApp />);
    dropOn([pdf()]);
    await screen.findByText('이 문서는 선형대수의 기초를 다룬다');
    expect(screen.queryByText('문서가 길어 앞부분만 요약했어요')).toBeNull();
  });

  it('두 파일을 놓으면 MULTIPLE_FILES 문구, fetch 미호출', async () => {
    render(<SummaryApp />);
    dropOn([pdf('a.pdf'), pdf('b.pdf')]);
    expect((await screen.findByRole('alert')).textContent).toContain('한 번에 PDF 하나만 올릴 수 있어요.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('PDF가 아니면 NOT_PDF 문구, fetch 미호출', async () => {
    render(<SummaryApp />);
    dropOn([new File([new Uint8Array(3)], 'a.png', { type: 'image/png' })]);
    expect((await screen.findByRole('alert')).textContent).toContain('PDF 파일만 올릴 수 있어요.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('로딩 중에는 업로드 상자가 없어 다시 놓을 수 없다', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<SummaryApp />);
    dropOn([pdf()]);
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.queryByText('PDF를 여기에 끌어다 놓으세요')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('서버 오류 응답이면 그 문구를 role=alert로', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ok: false,
        code: 'NO_TEXT',
        message: '글자를 읽을 수 없는 PDF라 요약할 수 없어요. 스캔한 문서는 아직 지원하지 않아요.',
      }),
    );
    render(<SummaryApp />);
    dropOn([pdf()]);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('글자를 읽을 수 없는 PDF라 요약할 수 없어요');
    // 오류 뒤에도 다시 올릴 수 있다
    expect(screen.getByText('PDF를 여기에 끌어다 놓으세요')).toBeTruthy();
  });

  it('다른 PDF 요약하기를 누르면 처음 화면', async () => {
    fetchMock.mockResolvedValue(jsonResponse(okResponse()));
    render(<SummaryApp />);
    dropOn([pdf()]);
    await screen.findByText('이 문서는 선형대수의 기초를 다룬다');
    await userEvent.click(screen.getByRole('button', { name: '다른 PDF 요약하기' }));
    expect(screen.getByText('PDF를 여기에 끌어다 놓으세요')).toBeTruthy();
    expect(screen.queryByText('이 문서는 선형대수의 기초를 다룬다')).toBeNull();
  });

  it('파일 선택 버튼으로도 올릴 수 있다', async () => {
    fetchMock.mockResolvedValue(jsonResponse(okResponse()));
    const { container } = render(<SummaryApp />);
    expect(screen.getByRole('button', { name: '파일 선택' })).toBeTruthy();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, pdf());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('이 문서는 선형대수의 기초를 다룬다')).toBeTruthy();
  });

  it('긴 영어 토큰이 들어도 한 줄 요약·개념·정의 용어에 줄바꿈 클래스가 있다', async () => {
    const long = 'Newtonian_mechanics_and_its_applications_in_engineering';
    fetchMock.mockResolvedValue(
      jsonResponse({
        ok: true,
        fileName: 'lecture.pdf',
        result: {
          oneLine: long,
          concepts: [{ name: `${long}_name`, description: `${long}_desc` }],
          definitions: [{ term: `${long}_term`, content: 'x' }],
          truncated: false,
        },
      }),
    );
    render(<SummaryApp />);
    dropOn([pdf()]);
    for (const text of [long, `${long}_name`, `${long}_desc`, `${long}_term`]) {
      const el = await screen.findByText(text);
      expect(el.className).toContain('wrap-anywhere');
    }
  });

  it('상자 밖에 파일을 놓거나 끌어도 기본 동작(파일 열기)이 막히고 fetch는 호출되지 않는다', () => {
    render(<SummaryApp />);
    for (const type of ['dragover', 'drop']) {
      const ev = new Event(type, { bubbles: true, cancelable: true });
      document.body.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('결과 화면에서도 상자 밖 드롭의 기본 동작이 막힌다', async () => {
    fetchMock.mockResolvedValue(jsonResponse(okResponse()));
    render(<SummaryApp />);
    dropOn([pdf()]);
    await screen.findByText('이 문서는 선형대수의 기초를 다룬다');
    for (const type of ['dragover', 'drop']) {
      const ev = new Event(type, { bubbles: true, cancelable: true });
      document.body.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('언마운트하면 window 드롭 방지 리스너가 정리된다', () => {
    const { unmount } = render(<SummaryApp />);
    unmount();
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
});
