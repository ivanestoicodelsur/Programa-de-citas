#!/usr/bin/env bash
# smoke.sh — verifica que el deploy en producción funciona.
# Uso: ./scripts/smoke.sh [BASE_URL]
# Ejemplo: ./scripts/smoke.sh https://gofixcompanymiami.com
set -euo pipefail

BASE="${1:-https://gofixcompanymiami.com}"
PASS=0
FAIL=0

ok()   { echo "  ✓ $1"; ((PASS++)) || true; }
fail() { echo "  ✗ $1"; ((FAIL++)) || true; }

echo ""
echo "═══════════════════════════════════════"
echo "  Smoke tests → $BASE"
echo "═══════════════════════════════════════"

# ── 1. Public health check ───────────────────────────────
echo ""
echo "1) Public health endpoint"
BODY=$(curl -fsS "$BASE/api/health" 2>&1) && ok "$BODY" || fail "GET /api/health falló"

# ── 2. Admin SPA devuelve HTML (no JSON) ─────────────────
echo ""
echo "2) Admin SPA /admin/login devuelve HTML"
CT=$(curl -fsSI "$BASE/admin/login" 2>/dev/null | grep -i "^content-type:" | tr -d '\r') || true
if echo "$CT" | grep -qi "text/html"; then
  ok "$CT"
else
  fail "Esperaba text/html, recibí: '$CT'"
fi

# ── 3. leads.js accesible ────────────────────────────────
echo ""
echo "3) /js/leads.js público"
CODE=$(curl -o /dev/null -w "%{http_code}" -fsS "$BASE/js/leads.js" 2>/dev/null) || CODE="err"
if [ "$CODE" = "200" ]; then
  ok "HTTP $CODE"
else
  fail "HTTP $CODE (esperaba 200)"
fi

# ── 4. Lead capture acepta POST ──────────────────────────
echo ""
echo "4) POST /api/leads/capture"
RESP=$(curl -fsS -X POST "$BASE/api/leads/capture" \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke_test_'$(date +%s)'@noreply.local","source":"gofix_repair_form","channel":"form"}' 2>&1) || RESP="error"
if echo "$RESP" | grep -q '"ok":true'; then
  ok "$RESP"
else
  fail "Respuesta inesperada: $RESP"
fi

# ── 5. POST /api/auth/login rechaza credenciales inválidas ──
echo ""
echo "5) Auth rechaza credenciales inválidas"
HTTP=$(curl -o /dev/null -w "%{http_code}" -s -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"noexiste@test.com","password":"wrong"}' 2>/dev/null) || HTTP="err"
if [ "$HTTP" = "401" ] || [ "$HTTP" = "400" ]; then
  ok "HTTP $HTTP (correcto — credenciales inválidas rechazadas)"
else
  fail "HTTP $HTTP (esperaba 401 o 400)"
fi

# ── 6. AI assistant está desactivado ────────────────────
echo ""
echo "6) AI assistant devuelve 403 (ENABLE_PUBLIC_AI_ASSISTANT=false)"
HTTP=$(curl -o /dev/null -w "%{http_code}" -s -X POST "$BASE/api/chat" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hola"}]}' 2>/dev/null) || HTTP="err"
if [ "$HTTP" = "403" ]; then
  ok "HTTP $HTTP — AI desactivado correctamente"
else
  fail "HTTP $HTTP (esperaba 403 — revisar ENABLE_PUBLIC_AI_ASSISTANT)"
fi

# ── 7. Sitio público raíz responde ───────────────────────
echo ""
echo "7) Sitio público / responde"
HTTP=$(curl -o /dev/null -w "%{http_code}" -fsS "$BASE/" 2>/dev/null) || HTTP="err"
if [ "$HTTP" = "200" ]; then
  ok "HTTP $HTTP"
else
  fail "HTTP $HTTP"
fi

# ── Resumen ─────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════"
echo "  Resultado: $PASS OK  /  $FAIL FALLO(S)"
echo "═══════════════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "Diagnóstico rápido:"
  echo "  Logs en vivo:       EasyPanel → programadecitas → Logs"
  echo "  Consola contenedor: EasyPanel → programadecitas → Console"
  echo "  Health directo:     curl $BASE/api/health"
  echo "  Test lead:          curl -X POST $BASE/api/leads/capture -H 'Content-Type: application/json' -d '{\"email\":\"x@x.com\",\"source\":\"test\",\"channel\":\"form\"}'"
  echo ""
  exit 1
fi

exit 0
