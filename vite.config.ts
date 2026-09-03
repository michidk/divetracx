import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import { devMigrations } from './scripts/vite-dev-migrations'

const divetracxEdition = process.env.DIVETRACX_EDITION ?? 'standard'
if (divetracxEdition !== 'standard' && divetracxEdition !== 'demo') {
  throw new Error('DIVETRACX_EDITION must be standard or demo')
}

const demoAssets = () => ({
  name: 'divetracx-demo-assets',
  generateBundle(this: { emitFile: (asset: object) => void }) {
    for (const filename of [
      'profile-diver.webp',
      'wreck-diver-front.webp',
      'wreck-diver-back.webp',
      'coral-lantern-reef.webp',
      'azure-step-wall.webp',
      'north-basin-wreck.webp',
    ]) {
      this.emitFile({
        type: 'asset',
        fileName: `media/demo/${filename}`,
        source: readFileSync(resolve('scripts/seed-assets/demo', filename)),
      })
    }
  },
})

export default defineConfig({
  server: { allowedHosts: true },
  preview: { allowedHosts: true },
  define: {
    __DIVETRACX_DEMO_MODE__: JSON.stringify(divetracxEdition === 'demo'),
  },
  resolve: {
    alias:
      divetracxEdition === 'demo'
        ? [{ find: /^@\/db$/, replacement: resolve('src/db/demo.ts') }]
        : [],
    tsconfigPaths: true,
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
    devMigrations(),
    ...(divetracxEdition === 'demo' ? [demoAssets()] : []),
    tailwindcss(),
    tanstackStart(),
    nitro({
      preset: divetracxEdition === 'demo' ? 'vercel' : 'bun',
      routes:
        divetracxEdition === 'demo'
          ? {}
          : {
              '/media/**': './src/lib/server/media-handler.ts',
              '/profile-card.png': './src/lib/server/profile-card-handler.ts',
            },
    }),
    viteReact(),
  ],
})
