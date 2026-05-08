/**
 * captureLead — fire-and-forget desde cualquier formulario o CTA.
 *
 * Usos:
 *   captureLead({ email, source: 'gofix_repair_form', channel: 'form' })
 *   captureLead({ phone, source: 'whatsapp_click',    channel: 'whatsapp', payload: { page } })
 *   captureLead({ email, source: 'newsletter_mindsetbuilder', channel: 'newsletter' })
 *
 * Garantías:
 *   - keepalive: true  → sobrevive si el usuario navega a otra página
 *   - Nunca lanza un error al caller
 *   - No bloquea el flujo del usuario (fire-and-forget)
 */
function captureLead(data) {
  try {
    const body = JSON.stringify(data);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/leads/capture', blob);
    } else {
      fetch('/api/leads/capture', {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        body:      body,
        keepalive: true,
      }).catch(function () {});
    }
  } catch (e) {}
}

/**
 * trackWhatsApp — engancha todos los links de WhatsApp de la página
 * y registra un evento anónimo con la página de origen.
 *
 * Llamar una vez al cargar el DOM:
 *   trackWhatsApp()
 */
function trackWhatsApp(extraData) {
  document.querySelectorAll('a[href^="https://wa.me"], a[href^="https://api.whatsapp.com"]')
    .forEach(function (a) {
      if (a._trackWA) return;
      a._trackWA = true;
      a.addEventListener('click', function () {
        captureLead(Object.assign({
          source:  'whatsapp_click',
          channel: 'whatsapp',
          payload: { url: a.href, page: window.location.pathname },
        }, extraData || {}));
      });
    });
}
