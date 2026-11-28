import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChatApi } from './server/chat-api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Runs the Tulsi chat API (Gemini primary, Ollama fallback) inside the Vite server,
// so `npm run dev` and `npm run preview` include the chat. Same plugin as the old site.
function tulsiChat(env){
  let api;
  const mount = server => {
    api ??= createChatApi(env);
    server.middlewares.use((req, res, next) => api.handle(req, res, next));
    server.httpServer?.once('listening', () => api.warmUp(server.config.logger));
  };
  return { name: 'tulsi-chat', configureServer: mount, configurePreviewServer: mount };
}

export default defineConfig(({ mode }) => {
  // '' = load every variable from .env (server-side only; just VITE_* reach the browser)
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), tulsiChat(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src/store'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('react-dom') || id.includes('react-router') || id.includes(`${path.sep}react${path.sep}`) || id.includes('/react/')) return 'react-vendor';
            if (id.includes('lucide-react')) return 'icons-vendor';
            if (id.includes('@tiptap') || id.includes('prosemirror')) return 'editor-vendor';
            if (id.includes('recharts') || id.includes('d3-')) return 'charts-vendor';
            return undefined;
          },
        },
      },
    },
    server: {
      // 127.0.0.1, not "localhost": on Windows Node resolves "localhost" to IPv6 (::1) while the API listens on
      // IPv4, so the API proxy failed and the site showed "could not load". http://localhost:5173 still works.
      host: '127.0.0.1',
      port: 5173,
      open: true,
      // shop API (`npm run dev:api`, port 3000). Tulsi chat is answered by the plugin above first.
      proxy: {
        '/api': {
          target: env.SHOP_API_URL || 'http://127.0.0.1:3000',
          // API server not running: say so, instead of a bare 500
          configure: (proxy) => proxy.on('error', (err, req, res) => {
            if (res.headersSent || typeof res.writeHead !== 'function') return;
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'The shop API is not running. `npm run dev` starts it with the site; check the [api] lines in that terminal for the error.', code: 'api_down' }));
          }),
        },
      },
    },
  };
});
