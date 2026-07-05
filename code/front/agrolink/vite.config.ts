import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  /** Proxy do Vite para o Spring Boot. Padrão local: 8080; use AGROLINK_API_URL para 8081. */
  const env = loadEnv(mode, '.', '');
  const apiTarget = env.AGROLINK_API_URL ?? 'http://localhost:8080';

  const proxyToApi = {
    '/api': {
      target: apiTarget,
      changeOrigin: true,
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          // Evita 403 CORS no Spring quando o browser envia Origin do ngrok
          proxyReq.removeHeader('origin');
          proxyReq.removeHeader('referer');
        });
      },
    },
    '/h2-console': {
      target: apiTarget,
      changeOrigin: true,
    },
    '/uploads': {
      target: apiTarget,
      changeOrigin: true,
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          proxyReq.removeHeader('origin');
          proxyReq.removeHeader('referer');
        });
      },
    },
  } as const;

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Agrolink',
          short_name: 'Agrolink',
          theme_color: '#1f6b3a',
          background_color: '#f3f7f4',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: 'favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        workbox: {
          navigateFallback: '/index.html',
          globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.(tile|basemaps)\..*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'map-tiles',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
          ],
        },
      }),
    ],
    server: {
      port: 5173,
      // Túnel ngrok (demo): sem isso o Vite bloqueia o Host externo
      allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app'],
      proxy: { ...proxyToApi },
    },
    // `vite preview` não reutiliza server.proxy — precisa declarar de novo
    preview: {
      port: 4173,
      proxy: { ...proxyToApi },
    },
  };
});
