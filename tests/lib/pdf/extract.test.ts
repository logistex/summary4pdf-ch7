import { describe, expect, it } from 'vitest';
import { extractPdfText } from '@/lib/pdf/extract';
import { makeBlankPdf, makeEncryptedLikePdf, makeKoreanCidPdf, makeTextPdf } from '../../helpers/pdf';

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

describe('extractPdfText: 비내장 CID 한국어 폰트', () => {
  it('CMap 이 있어야 읽히는 한국어 PDF 에서 한글을 꺼낸다', async () => {
    const lines = [
      '광합성은 식물이 빛 에너지를 화학 에너지로 바꾸는 과정이다.',
      '엽록체에서 일어나며 이산화탄소와 물이 포도당과 산소가 된다.',
      '뉴턴의 제2법칙에 따르면 가속도는 알짜힘에 비례한다.',
    ];
    const r = await extractPdfText(makeKoreanCidPdf(lines));
    expect(r.text).toMatch(/[가-힣]{5,}/);
    expect(r.text).toContain('광합성');
  });
});
