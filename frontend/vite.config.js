import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { createHash } from 'node:crypto';
function offlineShell() {
  return { name: 'eventore-offline-shell', apply: 'build', generateBundle(_options, bundle) {
    const assets = ['/index.html', ...Object.keys(bundle).filter(p => /\.(js|css)$/.test(p)).map(p => '/' + p)];
    const version = createHash('sha256').update(JSON.stringify(bundle)).digest('hex').slice(0,16);
    this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const CACHE = 'eventore-shell-${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('eventore-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.open(CACHE).then(c => c.match('/index.html'))));
  } else if (ASSETS.includes(url.pathname)) {
    e.respondWith(caches.open(CACHE).then(c => c.match(e.request)).then(hit => hit || fetch(e.request)));
  }
});` });
  } };
}
export default defineConfig({
  plugins: [vue(), offlineShell()],
  server: { proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } } }
});
