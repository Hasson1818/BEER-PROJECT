import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const page = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // Relative paths so the build also works from a sub-folder (e.g. GitHub Pages).
  base: './',
  build: {
    // Three.js alone is about 550 kB, so the default 500 kB warning always fires.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      input: {
        index: page('./index.html'),
        mainScreen: page('./main-screen/index.html'),
        tzavRishon: page('./tzav-rishon/index.html'),
      },
    },
  },
});
