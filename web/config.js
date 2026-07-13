// Runtime configuration for the web client — resolves the API base per environment,
// so the same files work locally AND when hosted, with no build step.
//
// Resolution order:
//   1. ?api=<url> query param            (quick override for testing)
//   2. window.SAFEPAY_API_BASE           (inject at deploy time if you want)
//   3. localhost/127.0.0.1 during dev    -> http://localhost:4000/api
//   4. anything else (hosted)            -> same origin + /api
//      (works when the API is served from the same domain — the default here,
//       since the backend serves this web app and proxies /api.)
(function () {
  var params = new URLSearchParams(location.search);
  var host = location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
  var apiBase =
    params.get('api') ||
    window.SAFEPAY_API_BASE ||
    (isLocal ? 'http://localhost:4000/api' : location.origin + '/api');
  window.APP_CONFIG = { API_BASE: apiBase };
})();
