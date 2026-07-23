import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [vue(), cloudflare()],
  server: {
    proxy: {
      '/api/wfm': {
        target: 'https://api.warframe.market',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/wfm/, ''),
      },
    },
  },
})