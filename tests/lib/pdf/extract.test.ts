import { describe, expect, it } from 'vitest';
import { extractPdfText } from '@/lib/pdf/extract';
import { makeBlankPdf, makeEncryptedLikePdf, makeTextPdf } from '../../helpers/pdf';

describe('extractPdfText', () => {
  it('글자 있는 PDF에서 텍스트와 쪽수를 꺼낸다', async () => {
    const r = await extractPdfText(
      await makeTextPdf(['Photosynthesis converts light energy into chemical energy.', 'E = mc^2']),
    );
    expect(r.text).toContain('Photosynthesis');
    expect(r.pageCount).toBe(1);
  });
  it('글자 없는 PDF는 NO_TEXT', async () => {
    await expect(extractPdfText(await makeBlankPdf(3))).rejects.toMatchObject({ code: 'NO_TEXT' });
  });
  it('손상된 PDF는 UNREADABLE_PDF (서버가 죽지 않음)', async () => {
    await expect(extractPdfText(makeEncryptedLikePdf())).rejects.toMatchObject({ code: 'UNREADABLE_PDF' });
  });
  it('원본 바이트가 분리되지 않는다', async () => {
    const bytes = await makeTextPdf(['Photosynthesis converts light energy into chemical energy.']);
    const len = bytes.byteLength;
    await extractPdfText(bytes);
    expect(bytes.byteLength).toBe(len);
  });
});
