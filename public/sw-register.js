// Registers the service worker (public/sw.js) once the page has loaded.
// Loaded from both the app layout and the static map bundle; registration is
// idempotent, so loading it twice is harmless.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
