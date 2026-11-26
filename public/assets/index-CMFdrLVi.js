// Stub per i bundle di versioni precedenti di Cassetto (ormai non più pubblicati).
// Un service worker vecchio può servire un index.html in cache che punta a questi file:
// invece di una pagina bianca, rimuoviamo service worker e cache e ricarichiamo UNA volta
// sola (guardia in sessionStorage, nessun loop). Se non basta, mostriamo un messaggio.
(function () {
  var KEY = 'cassetto-legacy-heal';
  function msg() {
    var root = document.getElementById('root');
    if (!root) return;
    root.innerHTML =
      '<div role="alert" style="max-width:520px;margin:18vh auto 0;padding:24px;font:15px/1.5 system-ui,sans-serif;color:#f4f6fb;text-align:center">' +
      '<h1 style="font-size:24px;margin:0 0 8px">Cassetto è stato aggiornato</h1>' +
      '<p style="color:#b4bcd2;margin:0 0 18px">Chiudi e riapri l\u2019app per caricare la nuova versione. I tuoi dati restano sul dispositivo.</p>' +
      '<button id="cassetto-legacy-btn" style="min-height:48px;padding:0 24px;border:0;border-radius:100px;background:#38bdf8;color:#03202b;font-weight:700;font-size:15px;cursor:pointer">Riprova</button></div>';
    document.getElementById('cassetto-legacy-btn').onclick = function () {
      purge().then(function () { location.replace(base()); });
    };
  }
  function base() {
    return location.pathname.replace(/index\.html$/, '') + '?v=' + Date.now();
  }
  function purge() {
    var jobs = [];
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) {
          return Promise.all(rs.map(function (r) { return r.unregister(); }));
        }));
      }
      if (window.caches) {
        jobs.push(caches.keys().then(function (ks) {
          return Promise.all(ks.map(function (k) { return caches.delete(k); }));
        }));
      }
    } catch (e) {}
    return Promise.all(jobs).catch(function () {});
  }
  var done = false;
  try { done = sessionStorage.getItem(KEY) === '1'; } catch (e) { done = true; }
  if (done) { msg(); return; }
  try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
  purge().then(function () { location.replace(base()); });
})();
