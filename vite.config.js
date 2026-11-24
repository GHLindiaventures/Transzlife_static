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
    server: { port: 5173 },
  };
});
