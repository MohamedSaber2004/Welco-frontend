/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import plugin from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const gatewayTarget = env.VITE_PROXY_TARGET || env.VITE_API_BASE_URL || 'https://welco-gateway.runasp.net'
  // Hangfire dashboard target (non-API route; all /api reads go through the gateway)
  const productTarget = 'https://welco-product.runasp.net'
  return {
    plugins: [plugin()],
    test: {
      environment: 'jsdom',
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 56304,
      proxy: {
        // Gateway-first for proxy and exchange-rate/currency repos so provider
        // changes in the gateway are reflected immediately; product microservice
        // remains as fallback if gateway is unavailable.
        '/hangfire':               { target: productTarget,  changeOrigin: true, secure: false },
        '/files':                  { target: gatewayTarget, changeOrigin: true, secure: false },
        '/api': {
          target: gatewayTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
