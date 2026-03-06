import { defineConfig } from 'vite';
import { resolve } from 'path';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  base: '/utp-superapp-simulator/',
  root: '.',
  publicDir: 'public',
  plugins: [mkcert()],
  server: {
    port: 5173,
    open: true,
    https: true,
    proxy: {
      '/ords': {
        target: 'https://oracleapex.com',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',
        headers: {
          host: 'oracleapex.com',
          origin: 'https://oracleapex.com',
          referer: 'https://oracleapex.com'
        },
        configure: (proxy, options) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            if (proxyRes.headers.location) {
              proxyRes.headers.location = proxyRes.headers.location.replace('https://oracleapex.com', '');
            }
          });
        }
      },
      '/i/': {
        target: 'https://oracleapex.com',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost'
      },
      '/wwv_flow': {
        target: 'https://oracleapex.com',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost'
      },
      '/pls': {
        target: 'https://oracleapex.com',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost'
      }
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        demo: resolve(__dirname, 'demo/demo-miniapp.html'),
      },
    },
  },
});
