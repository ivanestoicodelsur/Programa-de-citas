#!/usr/bin/env bash
# post-deploy-check.sh — verifica el estado completo del sistema después de cada deploy.
# Uso:  ./scripts/post-deploy-check.sh [BASE_URL] [ADMIN_EMAIL] [ADMIN_PASSWORD]
# Ej:   ./scripts/post-deploy-check.sh https://gofixcompanymiami.com admin@gofix.com MiPass123
set -euo pipefail

BASE="${1:-https://gofixcompanymiami.com}"
EMAIL="${2:-${SEED_ADMIN_EMAIL:-admin@example.com}}"
PASS="${3:-${SEED_ADMIN_PASSWORD:-}}"

PASS_COUNT=0
FAIL_COUNT=0
TOKEN=""

ok()   { echo "  ✅ $1"; ((PASS_COUNT++)) || true; }
fail() { echo "  ❌ $1"; ((FAIL_COUNT++)) || true; }
info() { echo "     ↳ $1"; }

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "  Post-deploy check  →  $BASE"
echo "╚══════════════════════════════════════════════╝"

# ── 1. Public health ─────────────────────────────────────────────────────────
echo ""
echo "1) GET /api/health (public)"
BODY=$(curl -fsS "$BASE/api/health" 2>&1) && ok "$BODY" || fail "GET /api/health falló"

# ── 2. Admin health (no auth) ─────────────────────────────────────────────────
echo ""
echo "2) GET /api/admin/health (sin token)"
HTTP=$(curl -o /dev/null -w "%{http_code}" -s "$BASE/api/admin/health") || HTTP="err"
BODY=$(curl -s "$BASE/api/admin/health" 2>/dev/null)
if [ "$HTTP" = "200" ] && echo "$BODY" | grep -q '"ok":true'; then
  ok "HTTP $HTTP — $BODY"
else
  fail "HTTP $HTTP — esperaba 200 {ok:true}. Body: $BODY"
fi

# ── 3. Chat status flag ───────────────────────────────────────────────────────
echo ""
echo "3) GET /api/chat/status"
BODY=$(curl -s "$BASE/api/chat/status" 2>/dev/null)
if echo "$BODY" | grep -q '"enabled"'; then
  ok "$BODY"
else
  fail "Respuesta inesperada: $BODY"
fi

# ── 4. Admin SPA ─────────────────────────────────────────────────────────────
echo ""
echo "4) GET /admin/login → debe ser text/html"
HTTP=$(curl -o /dev/null -w "%{http_code}" -s "$BASE/admin/login") || HTTP="err"
CT=$(curl -sI "$BASE/admin/login" 2>/dev/null | grep -i "^content-type" | tr -d '\r')
if [ "$HTTP" = "200" ] && echo "$CT" | grep -qi "text/html"; then
  ok "HTTP $HTTP  |  $CT"
else
  fail "HTTP $HTTP  |  $CT  (esperaba 200 text/html)"
fi

# ── 5. Login con credenciales reales ─────────────────────────────────────────
echo ""
echo "5) POST /api/auth/login"
if [ -z "$PASS" ]; then
  info "ADMIN_PASSWORD no proporcionado — omitiendo login real"
  FAIL_COUNT=$((FAIL_COUNT))
else
  LOGIN_RESP=$(curl -s -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" 2>/dev/null) || LOGIN_RESP="error"
  if echo "$LOGIN_RESP" | grep -q '"token"'; then
    TOKEN=$(echo "$LOGIN_RESP" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    ok "Login exitoso — token obtenido"
    info "Email: $EMAIL"
  else
    fail "Login falló: $LOGIN_RESP"
  fi
fi

# ── 6. GET /api/auth/me (con token) ──────────────────────────────────────────
echo ""
echo "6) GET /api/auth/me (con token)"
if [ -n "$TOKEN" ]; then
  RESP=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/auth/me" 2>/dev/null)
  if echo "$RESP" | grep -qi '"email"\|"role"'; then
    ok "Usuario autenticado: $(echo "$RESP" | grep -o '"email":"[^"]*"')"
  else
    fail "GET /api/auth/me respondió: $RESP"
  fi
else
  info "Sin token — test omitido"
fi

# ── 7. Lead capture ───────────────────────────────────────────────────────────
echo ""
echo "7) POST /api/leads/capture"
RESP=$(curl -s -X POST "$BASE/api/leads/capture" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"postdeploy_$(date +%s)@noreply.local\",\"source\":\"post_deploy_check\",\"channel\":\"test\"}" 2>/dev/null) || RESP="error"
if echo "$RESP" | grep -q '"ok":true'; then
  ok "$RESP"
else
  fail "Respuesta inesperada: $RESP"
fi

# ── 8. GET /api/leads (autenticado) ──────────────────────────────────────────
echo ""
echo "8) GET /api/leads (autenticado)"
if [ -n "$TOKEN" ]; then
  HTTP=$(curl -o /dev/null -w "%{http_code}" -s -H "Authorization: Bearer $TOKEN" "$BASE/api/leads?limit=1") || HTTP="err"
  if [ "$HTTP" = "200" ]; then
    ok "HTTP $HTTP"
  else
    fail "HTTP $HTTP (esperaba 200)"
  fi
else
  info "Sin token — test omitido"
fi

# ── 9. Auth rechaza credenciales inválidas ────────────────────────────────────
echo ""
echo "9) Auth rechaza credenciales incorrectas"
HTTP=$(curl -o /dev/null -w "%{http_code}" -s -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"noexiste@test.com","password":"wrong"}') || HTTP="err"
if [ "$HTTP" = "401" ] || [ "$HTTP" = "400" ]; then
  ok "HTTP $HTTP — rechazadas correctamente"
else
  fail "HTTP $HTTP (esperaba 401 o 400)"
fi

# ── 10. Landing pública responde ──────────────────────────────────────────────
echo ""
echo "10) GET / landing pública"
HTTP=$(curl -o /dev/null -w "%{http_code}" -s "$BASE/") || HTTP="err"
if [ "$HTTP" = "200" ]; then
  ok "HTTP $HTTP"
else
  fail "HTTP $HTTP"
fi

# ── Resumen ───────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
printf "  Resultado: %d ✅   /   %d ❌\n" "$PASS_COUNT" "$FAIL_COUNT"
echo "╚══════════════════════════════════════════════╝"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "Diagnóstico rápido:"
  echo "  Logs del backend:  EasyPanel → programadecitas → Logs"
  echo "  Consola directa:   curl $BASE/api/health"
  echo ""
  exit 1
fi

exit 0
