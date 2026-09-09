import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png', 'images/*.png'],
      manifest: {
        id: '/',
        name: 'Loyal',
        short_name: 'Loyal',
        description: 'Loyal - Restaurant employee loyalty stamp tool',
        theme_color: '#8B5E3C',
        background_color: '#1a0f08',
        display: 'standalone',
        display_override: ['standalone', 'fullscreen'],
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'en-US',
        categories: ['business', 'productivity'],
        prefer_related_applications: false,
        icons: [
          {
            src: 'images/employee_app_icon.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'images/employee_app_icon.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'images/employee_app_icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallbackDenylist: [/^\/socket\.io/],
      },
    }),
  ],
})
