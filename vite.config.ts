import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import pkg from './package.json';

// 버전: package.json 버전 + 빌드 시각(+ GitHub 커밋 7자리)
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const sha = process.env.GITHUB_SHA ? ` · ${process.env.GITHUB_SHA.slice(0, 7)}` : '';
const APP_VERSION = `${pkg.version} (${stamp}${sha})`;

export default defineConfig(({ mode }) => ({
  // GitHub Pages 에서는 /piano-practice/ 아래에서 열립니다 (배포 워크플로가 BASE_PATH 지정)
  base: process.env.BASE_PATH ?? '/',
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  plugins: [
    // Web MIDI 는 HTTPS(또는 localhost)에서만 → phone 모드는 임시 인증서
    ...(mode === 'phone' ? [basicSsl()] : []),
    react(),
    VitePWA({
      registerType: 'prompt',
      workbox: { skipWaiting: true, clientsClaim: true },
      includeAssets: ['icon.svg', 'icon-*.png', 'apple-touch-icon.png'],
      manifest: {
        name: '피아노 연습 도우미',
        short_name: '피아노',
        description: '디지털 피아노를 연결해 배우고 연습하는 앱',
        theme_color: '#1f2937',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'any',
        lang: 'ko',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: { environment: 'node', include: ['tests/**/*.test.ts'], exclude: ['tests/local/**', 'node_modules/**'] },
}));
