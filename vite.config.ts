import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative asset paths so the built dist/ works from any URL,
  // including the GitHub Pages subpath.
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Seven Seas Idle',
        short_name: 'Seven Seas',
        description: 'A deep idle pirate adventure — build your fleet, discover islands, become a legend.',
        theme_color: '#1d130b',
        background_color: '#1d130b',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Use relative URLs so the service worker works from any deploy path.
        navigateFallback: null,
      },
    }),
  ],
});
