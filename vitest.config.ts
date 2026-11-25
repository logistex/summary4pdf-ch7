import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // tsconfig의 "@/*" 별칭과 동일하게 맞춘다
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // 기본은 node 환경. 컴포넌트 시험은 파일 맨 위에 `// @vitest-environment jsdom`을 쓴다
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
