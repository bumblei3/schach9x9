import { defineConfig, type Plugin } from 'vite';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Größer als das geht nicht in den Precache: das 3D-Modul (three.js) wird erst
 * bei aktiviertem 3D-Modus geladen und ist allein 595 KiB. Alles andere gehört
 * in den Offline-Shell.
 */
const MAX_PRECACHE_BYTES = 256 * 1024;

/**
 * Fills `BUILD_PRECACHE` in the shipped service worker with the asset URLs this
 * build actually emitted.
 *
 * `public/service-worker.js` is copied verbatim into `dist/`, so a hardcoded
 * precache list would go stale on every content-hash change. Reading the emitted
 * `dist/` directory keeps the worker's install step in sync with the bundle
 * without pulling in a PWA plugin.
 */
function injectServiceWorkerPrecache(): Plugin {
  return {
    name: 'schach9x9-sw-precache',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      const swPath = join(distDir, 'service-worker.js');

      const urls: string[] = [];
      for (const entry of readdirSync(distDir, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const file = entry.name;
        if (file === 'service-worker.js') continue; // der Worker cachet sich nicht selbst
        const relative = `./${file}`;
        if (/\.(json|png)$/i.test(file)) {
          urls.push(relative);
          continue;
        }
        if (!/\.(js|css)$/i.test(file)) continue;
        if (statSync(join(distDir, file)).size > MAX_PRECACHE_BYTES) continue;
        urls.push(relative);
      }
      for (const file of readdirSync(join(distDir, 'assets'))) {
        const relative = `./assets/${file}`;
        if (!/\.(js|css)$/i.test(file)) continue;
        if (statSync(join(distDir, 'assets', file)).size > MAX_PRECACHE_BYTES) continue;
        urls.push(relative);
      }

      // Direkt lesen statt existsSync + readFileSync: CodeQL meldet sonst eine
      // Race zwischen "existiert die Datei?" und "schreibe sie".
      let worker: string;
      try {
        worker = readFileSync(swPath, 'utf8');
      } catch {
        return; // kein Worker in dist/ — nichts zu injizieren
      }
      const marker = 'const BUILD_PRECACHE = [];';
      if (!worker.includes(marker)) return;

      const unique = [...new Set(urls)].sort();
      const list = unique.map(url => `  '${url}'`).join(',\n');
      writeFileSync(swPath, worker.replace(marker, `const BUILD_PRECACHE = [\n${list},\n];`));
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: 'public',
  worker: {
    format: 'es',
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './js'),
    },
  },
  plugins: [injectServiceWorkerPrecache()],
});
