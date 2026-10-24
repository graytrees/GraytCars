import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app at https://graytrees.github.io/GraytCars/
const base = process.env.BASE_PATH || '/GraytCars/';

export default defineConfig({
  base,
  plugins: [VitePWA({
    registerType: 'prompt',
    includeAssets: ['icon-192.png', 'icon-512.png'],
    manifest: {
      // id changed 16 Oct 2026 so Android treats it as a fresh install after a stuck uninstall
      id: base + 'app', name: 'GraytCars', short_name: 'GraytCars', description: 'Car maintenance and fuel log',
      start_url: base, scope: base, display: 'standalone', orientation: 'portrait-primary',
      background_color: '#0B1A2E', theme_color: '#0B1A2E',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      // Long-press the app icon → straight to a fill-up. Each can be dragged onto the home screen.
      shortcuts: [
        { name: 'Fill up Mustang', short_name: 'Fill Mustang', url: base + '?fill=c-mustang', icons: [{ src: 'shortcut-mustang.png', sizes: '192x192', type: 'image/png' }] },
        { name: 'Fill up Everest', short_name: 'Fill Everest', url: base + '?fill=c-everest', icons: [{ src: 'shortcut-everest-v2.png', sizes: '192x192', type: 'image/png' }] },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      navigateFallback: base + 'index.html',
    },
  })],
});
