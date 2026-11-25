// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorPage from '@/app/error';
import GlobalError from '@/app/global-error';

afterEach(cleanup);

describe('오류 경계', () => {
  it('error.tsx: 한국어 안내와 다시 시도 버튼', async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error('x')} reset={reset} />);
    expect(screen.getByText('문제가 생겼어요. 페이지를 새로고침해 주세요.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
  it('global-error.tsx: 같은 문구와 버튼', async () => {
    const reset = vi.fn();
    // <html> 안에 렌더하므로 jsdom 경고를 무시하고 내용만 확인한다
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<GlobalError error={new Error('x')} reset={reset} />);
    expect(screen.getByText('문제가 생겼어요. 페이지를 새로고침해 주세요.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
