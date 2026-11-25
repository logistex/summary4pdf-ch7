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

/**
 * 비내장 CID 한국어 폰트(Type0 + CIDFontType0, /UniKS-UCS2-H, FontFile 없음)를 쓰는
 * 한 쪽짜리 PDF를 손으로 만든다. 글자를 읽으려면 pdf.js 의 CMap 파일이 필요하다.
 */
export function makeKoreanCidPdf(lines: string[]): Uint8Array {
  const hex = (s: string) =>
    Array.from(s)
      .map((ch) => ch.charCodeAt(0).toString(16).padStart(4, '0'))
      .join('')
      .toUpperCase();
  const content = lines.map((l, i) => `BT /F1 12 Tf 50 ${780 - i * 20} Td <${hex(l)}> Tj ET`).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type0 /BaseFont /HYSMyeongJo-Medium /Encoding /UniKS-UCS2-H /DescendantFonts [6 0 R] >>',
    '<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HYSMyeongJo-Medium /CIDSystemInfo << /Registry (Adobe) /Ordering (Korea1) /Supplement 1 >> /FontDescriptor 7 0 R /DW 1000 >>',
    '<< /Type /FontDescriptor /FontName /HYSMyeongJo-Medium /Flags 6 /FontBBox [0 -148 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -148 /CapHeight 700 /StemV 80 >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
