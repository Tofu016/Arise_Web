import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // maplibre-gl loads its rendering work as a separate worker file
    // (maplibre-gl-worker.mjs) rather than inlining it — Vite's esbuild
    // pre-bundler doesn't carry that file's on-disk path along when it
    // re-bundles the package, so a stale/renamed cache entry under
    // node_modules/.vite/deps can leave the worker pointing at a file
    // that no longer exists there. Excluding it from pre-bundling serves
    // it as its own native ESM module instead, which sidesteps this
    // entirely — maplibre-gl's own docs recommend the same fix for Vite.
    exclude: ['maplibre-gl'],
  },
})
