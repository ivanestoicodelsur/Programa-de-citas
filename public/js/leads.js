/**
 * leads.js — fire-and-forget desde formularios y CTAs.
 * Incluir en cualquier página:
 *   <script src="/js/leads.js"></script>
 *
 * Luego usar:
 *   window.captureLead({ email, source, channel, ... })
 *   window.trackWhatsApp({ page: '/cotizar' })
 */

window.captureLead = function (data) {
  try {
    fetch('/api/leads/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      keepalive: true,
    }).catch(function () {});
  } catch (e) {}
};

window.trackWhatsApp = function (payload) {
  window.captureLead({ source: 'whatsapp_click', channel: 'whatsapp', payload: payload });
};

/**
 * Auto-hook: engancha todos los links wa.me de la página al cargar.
 * Llamar una vez al final del DOM:   window.initWhatsAppTracking()
 */
window.initWhatsAppTracking = function (extraData) {
  document.querySelectorAll('a[href^="https://wa.me"], a[href^="https://api.whatsapp.com"]')
    .forEach(function (a) {
      if (a._tracked) return;
      a._tracked = true;
      a.addEventListener('click', function () {
        window.trackWhatsApp(
          Object.assign({ url: a.href, page: window.location.pathname }, extraData || {})
        );
      });
    });
};
