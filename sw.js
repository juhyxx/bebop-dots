// Service worker: lets BeBop Dots be installed as an app and used offline (sounds included).
//
// The page itself always comes from the network first, so a new version shows up on the next
// start; it's served from the cache only when offline. Other files come from the network first
// too while VERSION is 'dev' (so edits show up on reload) and from the cache once it is a real
// version. Changing VERSION makes browsers install the new worker and drop the old cache.
const VERSION = 'dev';
const CACHE = 'bebop-dots-' + VERSION;

// Everything the app loads. Keep in sync when adding files (tests/run.mjs checks it).
const FILES = [
  './',
  'manifest.webmanifest',
  'styles.css',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/icon.svg',
  'vendor/preact-htm.js',
  'vendor/vexflow.js',
  'src/app.js',
  'src/audio.js',
  'src/band.js',
  'src/course.js',
  'src/input.js',
  'src/lessons.js',
  'src/parts.js',
  'src/player.js',
  'src/scoring.js',
  'src/store.js',
  'src/theory.js',
  'src/ui/keyboard.js',
  'src/ui/staff.js',
  'samples/piano/A0.mp3',
  'samples/piano/A1.mp3',
  'samples/piano/A2.mp3',
  'samples/piano/A3.mp3',
  'samples/piano/A4.mp3',
  'samples/piano/A5.mp3',
  'samples/piano/A6.mp3',
  'samples/piano/A7.mp3',
  'samples/piano/C1.mp3',
  'samples/piano/C2.mp3',
  'samples/piano/C3.mp3',
  'samples/piano/C4.mp3',
  'samples/piano/C5.mp3',
  'samples/piano/C6.mp3',
  'samples/piano/C7.mp3',
  'samples/piano/C8.mp3',
  'samples/piano/Ds1.mp3',
  'samples/piano/Ds2.mp3',
  'samples/piano/Ds3.mp3',
  'samples/piano/Ds4.mp3',
  'samples/piano/Ds5.mp3',
  'samples/piano/Ds6.mp3',
  'samples/piano/Ds7.mp3',
  'samples/piano/Fs1.mp3',
  'samples/piano/Fs2.mp3',
  'samples/piano/Fs3.mp3',
  'samples/piano/Fs4.mp3',
  'samples/piano/Fs5.mp3',
  'samples/piano/Fs6.mp3',
  'samples/piano/Fs7.mp3',
  'samples/bass/Bb1.mp3',
  'samples/bass/Bb2.mp3',
  'samples/bass/Db2.mp3',
  'samples/bass/Db3.mp3',
  'samples/bass/E1.mp3',
  'samples/bass/E2.mp3',
  'samples/bass/E3.mp3',
  'samples/bass/G1.mp3',
  'samples/bass/G2.mp3',
  'samples/bass/G3.mp3',
  'samples/drums/hhc.wav',
  'samples/drums/hhc-soft.wav',
  'samples/drums/hhp.wav',
  'samples/drums/kick.wav',
  'samples/drums/kick-soft.wav',
  'samples/drums/ride.wav',
  'samples/drums/rim.wav',
  'samples/drums/snare.wav',
  'samples/drums/snare-soft.wav',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the HTTP cache, so no stale copy ends up in the new cache
  e.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => keys.filter((k) => k.startsWith('bebop-dots-') && k !== CACHE))
      .then((old) => Promise.all(old.map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// keep a copy of what came from the network (also the Google Fonts, which can't be listed above)
function keep(e, res) {
  if (res.status === 200 || res.type === 'opaque') {
    const copy = res.clone();
    e.waitUntil(caches.open(CACHE).then((cache) => cache.put(e.request, copy)));
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;

  if (req.mode === 'navigate' || VERSION === 'dev') {
    const fresh = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', redirect: 'manual' }) : fetch(req, { cache: 'no-cache' });
    e.respondWith(
      fresh
        .then((res) => keep(e, res))
        .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./') : Response.error()))),
    );
    return;
  }

  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => keep(e, res))));
});
