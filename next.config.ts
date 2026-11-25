import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 비내장 CID 한국어 폰트용 CMap 을 서버리스 파일 추적에 포함한다(unpdf 가 런타임에 읽는다)
  outputFileTracingIncludes: {
    "/api/summarize": ["./node_modules/pdfjs-dist/cmaps/**"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
