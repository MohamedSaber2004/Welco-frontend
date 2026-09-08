import { defineConfig, loadEnv } from 'vite';
import plugin from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const gatewayTarget = env.VITE_PROXY_TARGET || env.VITE_API_BASE_URL || 'https://welco-gateway.runasp.net'
  // Direct microservice targets — bypass the gateway for public reads while it redeploys
  const productTarget = 'https://welco-product.runasp.net'
  const contentTarget = 'https://welco-content.runasp.net'
  const certTarget = 'https://welco-certification.runasp.net'
  return {
    plugins: [plugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 56304,
      proxy: {
        // Public catalog reads — direct to microservices (gateway 502 fallback)
        '/api/v1/products':        { target: productTarget,  changeOrigin: true, secure: false },
        '/api/v1/categories':      { target: productTarget,  changeOrigin: true, secure: false },
        '/api/v1/currencies':      { target: productTarget,  changeOrigin: true, secure: false },
        '/api/v1/exchange-rates':  { target: productTarget,  changeOrigin: true, secure: false },
        '/hangfire':               { target: productTarget,  changeOrigin: true, secure: false },
        '/api/v1/catalog':         { target: productTarget,  changeOrigin: true, secure: false },
        '/api/v1/certifications':  { target: certTarget,     changeOrigin: true, secure: false },
        '/api/v1/documents':       { target: contentTarget,  changeOrigin: true, secure: false },
        '/api/v1/landing-pages':   { target: contentTarget,  changeOrigin: true, secure: false },
        '/api/v1/help':            { target: contentTarget,  changeOrigin: true, secure: false },
        '/api/v1/trade-shows':     { target: contentTarget,  changeOrigin: true, secure: false },
        '/files':                  { target: gatewayTarget, changeOrigin: true, secure: false },
        // Everything else (auth, sales, commerce, user-management, attachments) through the gateway
        '/api': {
          target: gatewayTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
