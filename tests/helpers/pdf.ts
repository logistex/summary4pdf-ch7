import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/** 표준 Helvetica로 영어 줄을 적은 한 쪽짜리 PDF를 메모리에서 만든다 */
export async function makeTextPdf(lines: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  lines.forEach((line, i) => {
    page.drawText(line, { x: 50, y: 780 - i * 20, size: 12, font });
  });
  return doc.save();
}

/** 사각형만 그린 PDF (글자 없는 스캔본 대용) */
export async function makeBlankPdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595, 842]);
    page.drawRectangle({ x: 50, y: 50, width: 200, height: 200, color: rgb(0.8, 0.8, 0.8) });
  }
  return doc.save();
}

/** PDF 헤더 뒤에 쓰레기 바이트가 붙은 손상 PDF (열기 실패 시험용) */
export function makeEncryptedLikePdf(): Uint8Array {
  const header = new TextEncoder().encode('%PDF-1.7\n');
  const garbage = new Uint8Array(256).map((_, i) => (i * 37 + 11) % 256);
  const out = new Uint8Array(header.length + garbage.length);
  out.set(header);
  out.set(garbage, header.length);
  return out;
}
