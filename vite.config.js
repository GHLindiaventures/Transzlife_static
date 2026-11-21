import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // '@' = the store folder, so the copied shadcn/ui imports (@/components/ui, @/lib) resolve unchanged
  resolve: { alias: { '@': fileURLToPath(new URL('./src/store', import.meta.url)) } },
  server: { port: 5173 },
});
