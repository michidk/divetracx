import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  server: { allowedHosts: true },
  preview: { allowedHosts: true },
  resolve: {
    tsconfigPaths: true,
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    nitro({
      preset: 'bun',
      routes: {
        '/media/**': './src/lib/server/media-handler.ts',
        '/profile-card.png': './src/lib/server/profile-card-handler.ts',
      },
    }),
    viteReact(),
  ],
})
