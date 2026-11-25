// QA용 샘플 PDF 생성 스크립트. 실행: node scripts/make-sample-pdfs.mjs
// 결과물은 samples/ 에 만들어지며 git 에는 올리지 않는다(.gitignore).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "samples");
const KO_FONT = "C:/Windows/Fonts/malgun.ttf";
const MAX_BYTES = 4 * 1024 * 1024; // 서버 허용 최대 크기

const PAGE = { w: 595, h: 842, margin: 56 };

// 글자 폭 기준으로 줄바꿈 (공백이 없는 한글도 글자 단위로 자른다)
function wrap(text, font, size, maxWidth) {
  const lines = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      if (font.widthOfTextAtSize(line + word, size) <= maxWidth) {
        line += word;
        continue;
      }
      if (line.trim()) lines.push(line.trimEnd());
      line = "";
      for (const ch of word.trimStart()) {
        if (font.widthOfTextAtSize(line + ch, size) > maxWidth) {
          lines.push(line);
          line = ch;
        } else {
          line += ch;
        }
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

// blocks: { text, size?, gap? }[] 를 쪽 단위로 쓴다. pageBreaks: 새 쪽을 시작할 블록 인덱스
async function textPdf(blocks, { fontBytes, pageBreaks = [] } = {}) {
  const pdf = await PDFDocument.create();
  let font;
  if (fontBytes) {
    pdf.registerFontkit(fontkit);
    font = await pdf.embedFont(fontBytes, { subset: true });
  } else {
    font = await pdf.embedFont(StandardFonts.Helvetica);
  }
  const width = PAGE.w - PAGE.margin * 2;
  let page = null;
  let y = 0;
  const newPage = () => {
    page = pdf.addPage([PAGE.w, PAGE.h]);
    y = PAGE.h - PAGE.margin;
  };
  newPage();
  blocks.forEach((b, i) => {
    if (pageBreaks.includes(i)) newPage();
    const size = b.size ?? 11;
    const lead = size * 1.5;
    for (const line of wrap(b.text, font, size, width)) {
      if (y - lead < PAGE.margin) newPage();
      y -= lead;
      if (line) page.drawText(line, { x: PAGE.margin, y, size, font, color: rgb(0, 0, 0) });
    }
    y -= b.gap ?? 8;
  });
  return pdf;
}

const H = (text) => ({ text, size: 15, gap: 6 });
const P = (text) => ({ text });

// 영어 논문 형식 (정의 1개, 공식 포함)
const enPaperBlocks = [
  { text: "Momentum Conservation in Elastic Collisions: A Short Study", size: 18, gap: 4 },
  { text: "A. Researcher, B. Scholar - Department of Physics", size: 10, gap: 14 },
  H("Abstract"),
  P("This paper examines how momentum and kinetic energy behave when two bodies collide elastically. We derive the governing relations from Newton's laws, verify them against a simple air-track experiment, and discuss the sources of the small deviations that were observed. Our results confirm that total momentum is conserved to within two percent."),
  H("1. Introduction"),
  P("Collisions are among the oldest problems in classical mechanics. Understanding them requires a precise vocabulary, so we begin with the central definition used throughout this paper."),
  P("Definition 1 (Momentum). The momentum of a body is the product of its mass and its velocity. It is a vector quantity that points in the same direction as the velocity of the body."),
  P("Newton's second law relates the net force acting on a body to its acceleration. In its simplest form it is written as F = m x a, where F is the net force, m is the mass, and a is the acceleration. Equivalently, the force equals the rate of change of momentum."),
  H("2. Method"),
  P("Two carts of known mass were placed on a nearly frictionless air track. The first cart was pushed toward the second, which was initially at rest. Photogate sensors recorded the velocity of each cart before and after the collision. Each trial was repeated twenty times, and the mean and standard deviation of every measurement were computed."),
  P("For an isolated system the total momentum before the collision equals the total momentum after it. For two bodies this is expressed as m1 x v1 + m2 x v2 = m1 x v1' + m2 x v2'. In an elastic collision the total kinetic energy, given by KE = (1/2) x m x v^2 for each body, is also conserved."),
  H("3. Results"),
  P("The measured total momentum after the collision differed from the initial value by 1.8 percent on average. The kinetic energy loss was slightly larger, at 3.4 percent, which we attribute to residual friction and to small deformations of the bumpers. When the mass ratio was increased, the lighter cart rebounded with a speed close to the theoretical prediction."),
  P("In summary: for equal masses the moving cart stopped completely and the resting cart took over its velocity. For a heavy cart striking a light one, both carts moved forward after the impact. For a light cart striking a heavy one, the light cart bounced back."),
  H("4. Discussion"),
  P("The small discrepancies between theory and measurement are consistent with the known limitations of the apparatus. Air-track friction is not exactly zero, and the photogate timing has a resolution of one millisecond. Future work could use a longer track and a higher sampling rate to reduce these errors further."),
  H("5. Conclusion"),
  P("Momentum is conserved in elastic collisions within experimental error, and kinetic energy is conserved to a good approximation. The relations derived from Newton's laws describe the observed behavior of the carts well, and the simple apparatus is suitable for teaching these ideas in an introductory laboratory course."),
  H("References"),
  P("[1] I. Newton, Philosophiae Naturalis Principia Mathematica, 1687.\n[2] D. Halliday, R. Resnick, J. Walker, Fundamentals of Physics, Wiley."),
];

// 한국어 강의 자료 2쪽 (정의, 공식 포함). 8번 블록("6. 연습 문제")부터 2쪽
const koLectureBlocks = [
  { text: "물리학 개론 3강: 힘과 운동", size: 18, gap: 10 },
  H("1. 학습 목표"),
  P("이번 강의에서는 힘, 질량, 가속도의 관계를 이해하고 뉴턴의 운동 법칙으로 일상의 운동을 설명하는 방법을 배운다. 강의가 끝나면 간단한 문제에서 가속도와 힘을 직접 계산할 수 있어야 한다."),
  H("2. 핵심 개념"),
  P("정의: 힘이란 물체의 속도나 모양을 변화시키는 원인이 되는 물리량이다. 힘은 크기와 방향을 모두 가지는 벡터이며 단위는 뉴턴(N)이다."),
  P("뉴턴의 제2법칙에 따르면 물체의 가속도는 작용하는 알짜힘에 비례하고 질량에 반비례한다. 이를 식으로 쓰면 F = m × a 이다. 여기서 F는 알짜힘, m은 질량, a는 가속도를 뜻한다."),
  P("1 N은 질량 1 kg인 물체에 1 m/s²의 가속도를 일으키는 힘이다. 따라서 질량이 2 kg인 수레를 6 N의 힘으로 밀면 가속도는 3 m/s²가 된다."),
  H("3. 관성의 법칙"),
  P("뉴턴의 제1법칙은 관성의 법칙이라고도 한다. 물체에 작용하는 알짜힘이 0이면 정지해 있던 물체는 계속 정지해 있고, 운동하던 물체는 같은 속도로 등속 직선 운동을 계속한다. 버스가 갑자기 출발하면 몸이 뒤로 쏠리는 것이 대표적인 예이다."),
  P("관성의 크기는 질량으로 나타낸다. 질량이 클수록 운동 상태를 바꾸기 어렵기 때문에 같은 힘을 주어도 가속도가 작아진다."),
  H("4. 작용과 반작용"),
  P("뉴턴의 제3법칙은 한 물체가 다른 물체에 힘을 가하면 다른 물체도 크기가 같고 방향이 반대인 힘을 되돌려 준다는 내용이다. 두 힘은 서로 다른 물체에 작용하므로 상쇄되지 않는다. 로켓이 가스를 뒤로 내뿜으며 앞으로 나아가는 것이 이 법칙으로 설명된다."),
  H("5. 운동량과 충격량"),
  P("정의: 운동량은 물체의 질량과 속도의 곱이다. 식으로는 p = m × v 로 나타내며, 외부에서 힘이 작용하지 않으면 계의 전체 운동량은 보존된다."),
  P("충격량은 힘과 힘이 작용한 시간의 곱이며 운동량의 변화량과 같다. 즉 F × t = Δp 이다. 자동차의 에어백은 충돌 시간을 늘려 같은 운동량 변화에서 사람이 받는 힘을 줄여 준다."),
  H("6. 연습 문제"),
  P("문제 1. 질량 5 kg인 물체에 10 N의 알짜힘이 작용할 때 가속도를 구하시오.\n문제 2. 질량 0.5 kg인 공이 4 m/s로 날아가고 있을 때 운동량을 구하시오.\n문제 3. 질량 1000 kg인 자동차가 2 m/s²로 가속하기 위해 필요한 힘은 얼마인가?"),
  H("7. 정리"),
  P("힘은 운동 상태를 바꾸는 원인이고, 가속도는 힘에 비례하며 질량에 반비례한다. 관성, 작용과 반작용, 운동량 보존은 모두 일상의 현상을 설명하는 기본 도구이므로 다음 시간의 에너지 단원에서도 계속 사용한다."),
];
const KO_PAGE2_START = 12; // "5. 운동량과 충격량" 제목 블록부터 2쪽

// 정의·공식이 없는 짧은 영어 수필
const noDefsBlocks = [
  { text: "A Walk in the Early Morning", size: 18, gap: 10 },
  P("I woke up before the alarm that day, and the house was quiet in a way it rarely is. The light at the window was pale and grey, and somewhere down the street a dog barked twice and then gave up. I put on my shoes and went outside without really deciding to."),
  P("The air smelled of wet leaves. A man on a bicycle passed me, nodded, and disappeared around the corner as if he had never been there. The bakery on the corner had just turned on its lights, and through the glass I could see someone carrying trays of bread from the back."),
  P("I walked toward the river because it was the only direction that felt right. On the bridge I stopped and watched the water slide by, slow and brown, carrying a few yellow leaves toward the sea. A heron stood in the shallows, perfectly still, waiting for something I could not see."),
  P("It struck me how little I notice when I am in a hurry. The same street I cross every day was full of small things: a cracked blue door, a window box of herbs, a cat asleep on a warm car hood. None of it was important, and all of it was pleasant."),
  P("By the time I turned back, the town had started to wake. Shutters opened, a bus groaned past, and children in bright jackets dragged their feet toward school. I bought a loaf of warm bread and carried it home under my arm, grateful for the quiet hour that had belonged to nobody but me."),
];

// 도형만 있는 3쪽 (글자 없음)
async function scanPdf() {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < 3; i++) {
    const page = pdf.addPage([PAGE.w, PAGE.h]);
    page.drawRectangle({ x: 60, y: 200 + i * 40, width: 300, height: 200, color: rgb(0.8, 0.85, 0.95), borderColor: rgb(0.1, 0.1, 0.4), borderWidth: 2 });
    page.drawCircle({ x: 400, y: 600 - i * 50, size: 80, color: rgb(0.95, 0.8, 0.8) });
    page.drawLine({ start: { x: 60, y: 120 }, end: { x: 520, y: 140 + i * 30 }, thickness: 3, color: rgb(0.2, 0.2, 0.2) });
  }
  return pdf;
}

// 글자 있는 PDF 에 큰 무압축 스트림 객체를 넣어 목표 크기에 맞춘다(문서 구조는 유효하게 유지)
async function padToSize(blocks, targetBytes) {
  const build = async (padLen) => {
    const pdf = await textPdf(blocks);
    if (padLen > 0) {
      pdf.context.register(pdf.context.stream(randomBytes(padLen)));
    }
    return pdf.save({ useObjectStreams: false });
  };
  const base = (await build(0)).length;
  let pad = targetBytes - base - 200;
  let bytes = await build(pad);
  // 스트림 헤더 등 오차를 한 번 보정
  pad += targetBytes - bytes.length;
  bytes = await build(pad);
  return bytes;
}

// 긴 영어 논문: 본문 글자 수가 모델 입력 상한(120,000자)을 넘도록 만든다 (시간 예산 측정용)
const LONG_TARGET_CHARS = 130_000;
function longPaperBlocks() {
  // 결과가 매번 같도록 간단한 의사 난수(LCG)를 쓴다
  let seed = 20261125;
  const rnd = (n) => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed % n;
  };
  const subjects = ["The collision model", "Our measurement protocol", "The numerical scheme", "A careful calibration", "The second experiment", "This derivation", "The observed trend", "The control group"];
  const verbs = ["confirms", "refines", "contradicts", "extends", "stabilizes", "approximates", "explains", "constrains"];
  const objects = ["the conservation of momentum", "the expected energy transfer", "the boundary conditions of the track", "the variance of the sensor readings", "the dependence on the mass ratio", "the damping observed in later trials", "the linear regime of the response", "the assumption of negligible friction"];
  const tails = ["within the stated tolerance", "under repeated trials", "for every tested configuration", "as predicted by the first-order theory", "once the drift is corrected", "across all twenty runs", "in agreement with earlier reports", "at the highest sampling rate"];
  const sentence = () => `${subjects[rnd(8)]} ${verbs[rnd(8)]} ${objects[rnd(8)]} ${tails[rnd(8)]}.`;
  const blocks = [{ text: "Momentum Conservation in Elastic Collisions: An Extended Study", size: 18, gap: 10 }];
  let chars = 0;
  for (let sec = 1; chars < LONG_TARGET_CHARS; sec++) {
    blocks.push(H(`${sec}. Section ${sec}`));
    for (let para = 0; para < 6 && chars < LONG_TARGET_CHARS; para++) {
      const text = Array.from({ length: 6 }, sentence).join(" ");
      blocks.push(P(text));
      chars += text.length;
    }
  }
  return blocks;
}

const results = [];
async function emit(name, data, pages) {
  const bytes = Buffer.from(data);
  await writeFile(path.join(OUT, name), bytes);
  results.push({ name, bytes: bytes.length, pages });
}

await mkdir(OUT, { recursive: true });

// 1) 영어 논문
{
  const pdf = await textPdf(enPaperBlocks);
  await emit("en-paper.pdf", await pdf.save(), pdf.getPageCount());
}

// 2) 한국어 강의 자료 (글꼴이 없으면 이 파일만 건너뜀)
if (existsSync(KO_FONT)) {
  const fontBytes = await readFile(KO_FONT);
  const pdf = await textPdf(koLectureBlocks, { fontBytes, pageBreaks: [KO_PAGE2_START] });
  await emit("ko-lecture.pdf", await pdf.save(), pdf.getPageCount());
} else {
  console.warn(`[건너뜀] ko-lecture.pdf: 글꼴을 찾을 수 없음 (${KO_FONT})`);
}

// 3) 정의·공식 없는 수필
{
  const pdf = await textPdf(noDefsBlocks);
  await emit("no-defs.pdf", await pdf.save(), pdf.getPageCount());
}

// 4) 4MB 직전(약 3.9MB), 5) 4MB 초과(약 4.2MB)
{
  const near = await padToSize(enPaperBlocks, Math.round(3.9 * 1024 * 1024));
  await emit("near-4mb.pdf", near, (await PDFDocument.load(near)).getPageCount());
  const over = await padToSize(enPaperBlocks, Math.round(4.2 * 1024 * 1024));
  await emit("over-4mb.pdf", over, (await PDFDocument.load(over)).getPageCount());
}

// 6) 확장자만 pdf 인 텍스트 파일
await emit("fake.pdf", "이것은 PDF가 아니라 평범한 텍스트 파일입니다.\nThis is just a plain text file.\n", 0);

// 7) 글자 없는 도형 3쪽
{
  const pdf = await scanPdf();
  await emit("scan.pdf", await pdf.save(), pdf.getPageCount());
}

// 8) 헤더만 맞고 본문이 손상된 파일
await emit(
  "broken.pdf",
  Buffer.concat([Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R\n"), randomBytes(512)]),
  0,
);

// 9) 12만 자 이상 영어 본문의 긴 논문 (4MB 이하)
{
  const pdf = await textPdf(longPaperBlocks());
  await emit("long-paper.pdf", await pdf.save(), pdf.getPageCount());
}

// 요약 표
console.log("\n" + "파일".padEnd(18) + "바이트".padStart(12) + "  쪽수");
for (const r of results) {
  const note = r.bytes > MAX_BYTES ? "  (4MB 초과)" : "";
  console.log(r.name.padEnd(17) + String(r.bytes).padStart(12) + "  " + String(r.pages).padStart(3) + note);
}
