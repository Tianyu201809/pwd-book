import { defineConfig } from 'vitest/config'
import path from 'path'
import vue from '@vitejs/plugin-vue'

const vuePlugin = vue()
const transformVue = vuePlugin.transform as (code: string, id: string, options?: { ssr?: boolean }) => unknown
// Component tests use Vue's custom renderer in Node, so compile client render functions.
vuePlugin.transform = function (code, id) {
  return transformVue.call(this, code, id, { ssr: false })
}

export default defineConfig({
  plugins: [vuePlugin],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
