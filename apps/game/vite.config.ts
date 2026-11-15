import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GAME_BASE lets the preview deploy serve the game from a sub-path (e.g. /gta-bengaluru/play/).
export default defineConfig({
  base: process.env.GAME_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  build: { target: 'es2022', sourcemap: true },
});
