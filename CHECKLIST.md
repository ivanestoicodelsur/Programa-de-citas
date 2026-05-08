# CHECKLIST — Validación de captura de leads y funcionalidades nuevas

Ejecuta estos 10 pasos después de desplegar en EasyPanel para confirmar que todo funciona.

---

## 1. Health endpoint ✅
```
GET /api/admin/health   (requiere Bearer token admin/manager)
```
**Esperado:** `{ "ok": true, "db": { "sqlite": "connected", ... } }`
**Si falla:** Verificar que el contenedor tiene el volumen de SQLite montado correctamente.

---

## 2. Admin panel accesible
- Abrir `https://tu-dominio.com/admin` en el navegador.
- **Esperado:** Pantalla de login con fondo oscuro, logo "GO FIX MIAMI".
- **Si falla:** Verificar que `public/admin/` está incluido en el Dockerfile o en el volumen.

---

## 3. Login funciona
- Ingresar con las credenciales del admin (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD).
- **Esperado:** Panel hub con 6 tarjetas, chip verde "Sistema activo" arriba a la derecha.
- **Si falla:** Revisar que JWT_SECRET en .env coincide con el del contenedor.

---

## 4. Chip de salud en el topbar
- Observar el indicador arriba a la derecha al iniciar sesión.
- **Esperado:** `● Sistema activo` en verde.
- **Si falla:** Revisar la ruta GET /api/admin/health y los permisos del token.

---

## 5. Captura desde formulario de cotización GoFix
- Ir al formulario de cotización en la landing de GoFix.
- Completar con datos de prueba: nombre, email, teléfono.
- Al hacer submit, verificar en `/admin` → CRM que aparece una fila nueva con:
  - **source:** `gofix_repair_form`
  - **channel:** `form`
- **Cómo:** En el JS del formulario, agregar al submit:
  ```js
  captureLead({ name, email, phone, source: 'gofix_repair_form', channel: 'form' });
  ```

---

## 6. Captura desde click a WhatsApp
- Cargar `<script src="/js/leads.js"></script>` en la landing pública.
- Llamar `trackWhatsApp()` al cargar el DOM.
- Hacer click en el botón "+1 (786) 806-2197" (link wa.me).
- **Esperado:** Aparece fila en CRM con source `whatsapp_click` (puede ser anónimo).

---

## 7. Newsletter footer captura el email
- Ir al panel de admin `/admin`.
- Escribir un email real en el footer "MindsetBuilder · Newsletter" y hacer click "Suscribirme".
- **Esperado:**
  - Aparece "✓ ¡Suscrito!" en verde.
  - En CRM aparece fila con source `newsletter_mindsetbuilder`, channel `newsletter`.

---

## 8. AI assistant desactivado en landing pública
- Hacer una llamada directa al endpoint de chat:
  ```
  POST /api/chat
  body: { "messages": [{ "role": "user", "content": "hola" }] }
  ```
- **Esperado:** `403 { "error": "El asistente IA no está disponible…" }`
- **Para reactivar:** Setear `ENABLE_PUBLIC_AI_ASSISTANT=true` en el .env del contenedor.

---

## 9. Perfil de infoproductos sin cantidades de páginas
- Ir al panel admin `/admin` → sección "Mi Perfil / Historia".
- **Esperado:** Lista de 7 libros con título y tipo (Núcleo/Guía) únicamente.
  - Sin ningún número de páginas ni cantidades.
- Servicio 1 a 1 visible arriba con las 3 sesiones: Observación, Diagnóstico, Recomendación.

---

## 10. Captura en compra Stripe (server-side)
- Completar una compra de prueba en Stripe Checkout (modo test).
- Verificar en el webhook `/api/webhooks/stripe` que:
  - Se crea/actualiza un `Purchase` en SQLite.
  - Se crea un `Lead` con source `book-purchase`, channel `biblioteca`.
  - El lead queda con `status = customer` y `hasPurchased = true`.
- **Verificar en CRM:** Filtrar por `source = Compra Libro` → debe aparecer el comprador.

---

## Comandos para reiniciar en EasyPanel

Después de hacer push al repo:

1. En EasyPanel → tu servicio → **Redeploy** (o usar el botón "Deploy" si está conectado a git).
2. Si cambiaste variables de entorno (`.env`), hacerlo desde EasyPanel → **Environment** → guardar → Redeploy.
3. Para revisar logs en tiempo real: EasyPanel → tu servicio → **Logs**.

> No es necesario reiniciar manualmente. EasyPanel lo hace con el Redeploy.

---

## Variables de entorno nuevas (agregar en EasyPanel si aún no están)

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `ENABLE_PUBLIC_AI_ASSISTANT` | `false` | `true` para reactivar el chat IA público |
| `PORTAL_URL` | `https://gofixlibros.com/portal` | URL de redirección post-Stripe |
