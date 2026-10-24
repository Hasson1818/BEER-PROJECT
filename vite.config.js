import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const page = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // Relative paths so the build also works from a sub-folder (e.g. GitHub Pages).
  base: './',
  // Listen on the local network too, so a phone on the same Wi-Fi can open the game.
  server: { host: true },
  build: {
    // Three.js alone is about 550 kB, so the default 500 kB warning always fires.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      input: {
        index: page('./index.html'),
        mainScreen: page('./main-screen/index.html'),
        tzavRishon: page('./tzav-rishon/index.html'),
        yomSayarot: page('./yom-sayarot/index.html'),
        gibbushTayis: page('./gibbush-tayis/index.html'),
        interviewWeek: page('./interview-week/index.html'),
        pilotPath: page('./pilot-path/index.html'),
        pilotHomeTest: page('./pilot-path/home-test/index.html'),
        pilotYarpaA: page('./pilot-path/yarpa-a/index.html'),
        pilotYarpaB: page('./pilot-path/yarpa-b/index.html'),
      },
    },
  },
});
