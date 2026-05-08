# INTEGRATION.md — Integrar captura de leads desde el frontend React

Este documento contiene los snippets exactos para conectar el frontend React público
(`gofixcompanymiami.com`) con el backend de captura de leads.

---

## 1. Cargar el helper una vez (en el HTML raíz o en `_app.jsx` / `main.jsx`)

### Opción A — Script tag en `index.html` (Vite / CRA)
```html
<!-- Antes del cierre de </body> -->
<script src="https://gofixcompanymiami.com/js/leads.js"></script>
```

### Opción B — Import dinámico en `main.jsx` / `_app.jsx`
```js
// Solo en producción
if (typeof window !== 'undefined') {
  const script = document.createElement('script');
  script.src = '/js/leads.js';
  document.body.appendChild(script);
}
```

> **API expuesta tras cargar el script:**
> - `window.captureLead(data)` — envía un lead sin bloquear al usuario
> - `window.trackWhatsApp(payload)` — registra un click a WhatsApp
> - `window.initWhatsAppTracking()` — auto-hookea todos los links wa.me del DOM

---

## 2. Formulario de cotización GoFix (`/cotizar`)

```jsx
// components/QuoteForm.jsx
import { useRef } from 'react';

export default function QuoteForm() {
  const formRef = useRef();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formRef.current));

    // 1) Fire-and-forget al CRM (no bloquea el flujo)
    window.captureLead?.({
      name:    data.name,
      email:   data.email,
      phone:   data.phone,
      source:  'gofix_repair_form',
      channel: 'form',
      payload: { device: data.device, issue: data.issue },
    });

    // 2) Tu lógica normal (redirigir a WhatsApp, enviar email, etc.)
    window.open(`https://wa.me/17868062197?text=Hola, quiero cotizar: ${data.device}`, '_blank');
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <input name="name"   placeholder="Nombre" required />
      <input name="email"  type="email" placeholder="Email" />
      <input name="phone"  type="tel"   placeholder="Teléfono" required />
      <input name="device" placeholder="Dispositivo (ej. iPhone 15)" required />
      <textarea name="issue" placeholder="Describe el problema" required />
      <button type="submit">Solicitar cotización</button>
    </form>
  );
}
```

---

## 3. Formulario de Diseño Web

```jsx
// components/WebDesignForm.jsx
const handleSubmit = async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));

  window.captureLead?.({
    name:    data.name,
    email:   data.email,
    phone:   data.phone,
    source:  'web_design_form',
    channel: 'form',
    payload: { projectType: data.projectType, budget: data.budget },
  });

  // Tu lógica de redirección / confirmación
};
```

---

## 4. Newsletter MindsetBuilder (footer global)

```jsx
// components/NewsletterFooter.jsx
import { useState } from 'react';

export default function NewsletterFooter() {
  const [done, setDone] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    if (!email) return;

    window.captureLead?.({
      email,
      source:  'newsletter_mindsetbuilder',
      channel: 'newsletter',
    });

    setDone(true);
  };

  return (
    <footer>
      <p><strong>MindsetBuilder · Newsletter</strong></p>
      {done ? (
        <p>✓ ¡Suscrito!</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <input name="email" type="email" placeholder="tu@email.com" required />
          <button type="submit">Suscribirme</button>
        </form>
      )}
    </footer>
  );
}
```

---

## 5. CTAs de WhatsApp

### Auto-hook (recomendado — engancha todos los links wa.me automáticamente)
```jsx
// En App.jsx o en un useEffect al montar la app
import { useEffect } from 'react';

useEffect(() => {
  window.initWhatsAppTracking?.();
}, []);
```

### Manual en un botón específico
```jsx
<a
  href="https://wa.me/17868062197"
  target="_blank"
  rel="noopener noreferrer"
  onClick={() => window.trackWhatsApp?.({ page: window.location.pathname })}
>
  +1 (786) 806-2197
</a>
```

---

## 6. Callback de éxito de compra $100 (MindsetBuilder)

Ejecutar **después** de que Stripe confirme el pago en el cliente:

```jsx
// pages/checkout/success.jsx  (o el componente que Stripe redirige con ?checkout=success)
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom'; // o next/navigation

export default function CheckoutSuccess() {
  const [params] = useSearchParams();

  useEffect(() => {
    // Solo disparar una vez
    const alreadyTracked = sessionStorage.getItem('purchase_tracked');
    if (alreadyTracked) return;

    const email = params.get('email') || ''; // si Stripe lo pasa en success_url
    window.captureLead?.({
      email,
      source:  'community_purchase_100',
      channel: 'checkout',
      amount:  100,
      status:  'customer',
      payload: { sessionId: params.get('sid') },
    });

    sessionStorage.setItem('purchase_tracked', '1');
  }, []);

  return <h1>¡Bienvenido al Sistema!</h1>;
}
```

> **Nota:** La captura server-side ya ocurre automáticamente en el webhook de Stripe
> (`POST /api/webhooks/stripe`). Este snippet del cliente es complementario — si el
> usuario cierra el browser antes de llegar a la página de éxito, el webhook igualmente
> registra la compra en el CRM.

---

## 7. Variable de entorno requerida en el backend

Para que el backend acepte peticiones cross-origin del frontend React, asegúrate de que
`FRONTEND_URL` en el `.env` del contenedor incluya el dominio del frontend:

```
FRONTEND_URL=https://gofixcompanymiami.com
```

Si tienes múltiples orígenes (local + producción):
```
FRONTEND_URL=https://gofixcompanymiami.com,http://localhost:5173
```

---

## 8. Verificar que la integración funciona

1. Abre DevTools → Network en el navegador.
2. Llena el formulario de cotización y haz submit.
3. Busca una llamada a `POST /api/leads/capture` con status `201` o `200`.
4. Abre `https://gofixcompanymiami.com/admin/` → CRM → debe aparecer una fila nueva con
   `source = gofix_repair_form`.
