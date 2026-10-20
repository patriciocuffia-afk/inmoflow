// sw.js — InmoFlow. Red primero; si no hay conexión, la última copia guardada.
// OJO (aprendido en OBRICK): para navegaciones hay que pedir por req.url, no reusar el Request
// con modo 'navigate', porque fetch(req, {cache:'no-store'}) lanza TypeError.
var CACHE = 'inmoflow-v1';
var PROPIOS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(PROPIOS).catch(function(){}); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){ return Promise.all(ks.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); })); }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  var esDoc = req.mode === 'navigate' || req.destination === 'document';
  var esCdn = url.hostname === 'cdnjs.cloudflare.com';
  if (url.origin !== self.location.origin && !esCdn) return; // APIs y Google: directo a la red
  if (url.pathname.endsWith('version.json')) return;
  e.respondWith(
    fetch(esDoc ? req.url : req, esDoc ? { cache: 'no-store', credentials: 'same-origin' } : undefined)
      .then(function(r){ if (r && r.ok) { var cp = r.clone(); caches.open(CACHE).then(function(c){ c.put(esDoc ? './index.html' : req, cp); }); } return r; })
      .catch(function(){ return caches.match(esDoc ? './index.html' : req); })
  );
});
