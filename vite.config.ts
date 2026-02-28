import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command }) => {
  const base = command === 'build' ? '/Bloomline/' : '/';

  return {
    base,
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/icon-192.svg', 'icons/icon-512.svg'],
        manifest: {
          name: 'Bloomline',
          short_name: 'Bloomline',
          description: 'ブラウザで動く軽量アウトライナー',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/Bloomline/',
          scope: '/Bloomline/',
          lang: 'ja',
          icons: [
            {
              src: 'icons/icon-192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
            },
            {
              src: 'icons/icon-512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
            },
          ],
        },
        workbox: {
          navigateFallback: 'index.html',
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,txt,woff2}'],
        },
      }),
      viteSingleFile(),
    ],
    build: {
      outDir: 'dist',
      assetsInlineLimit: 100_000_000,
      cssCodeSplit: false,
    },
    test: {
      environment: 'node',
    },
  };
});
