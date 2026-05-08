# DEPLOY.md — Guía de despliegue en EasyPanel

> Ejecuta estos pasos en orden. No hay que tocar el servidor directamente.

---

## Pre-deploy checklist

- [ ] `git push origin main` — commits subidos a GitHub
- [ ] Variables de entorno configuradas en EasyPanel (ver sección abajo)
- [ ] Volumen `/app/data` creado y montado (ver sección abajo)

---

## 1. Variables de entorno en EasyPanel

Ir a **EasyPanel → programadecitas → Environment**.

Setear o confirmar TODAS estas variables:

```
NODE_ENV=production
PORT=4000

# Base de datos
SQL_DIALECT=sqlite
SQL_STORAGE=./data/repair.sqlite

# JWT (usa un string aleatorio largo)
JWT_SECRET=<string-aleatorio-64-chars>
JWT_EXPIRES_IN=7d

# Admin inicial (idempotente — solo crea si no existe)
SEED_ADMIN_NAME=Administrador
SEED_ADMIN_EMAIL=gofixcompany@gmail.com
SEED_ADMIN_PASSWORD=<tu-password-seguro>
SEED_ADMIN_SCOPE=central

# Frontend React (CORS)
FRONTEND_URL=https://gofixcompanymiami.com

# AI Chat — false = desactivado en landing pública
ENABLE_PUBLIC_AI_ASSISTANT=false

# Portal post-checkout Stripe
PORTAL_URL=https://gofixcompanymiami.com/portal

# Stripe (si aplica)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Anthropic (si reactivás el AI chat)
ANTHROPIC_API_KEY=sk-ant-api03-...

# MongoDB (opcional — logs de auditoría)
MONGODB_URI=mongodb://root:mongo1234@programadecitas_mongodb:27017/programadecitas

# Google Sheets (opcional — sync inventario)
GOOGLE_SHEETS_API_KEY=
GOOGLE_SHEETS_SPREADSHEET_IDS=
GOOGLE_SHEETS_LABELS=Apple,Samsung,Xiaomi,Motorola,LG,Huawei,Google Pixel
```

Hacer click en **Save**.

---

## 2. Volumen para SQLite (persistencia)

La base de datos SQLite vive en `/app/data/repair.sqlite`. Ese directorio
**debe ser un volumen montado** para sobrevivir reinicios del contenedor.

En EasyPanel → programadecitas → **Mounts**:

| Source (volume name) | Target (en contenedor) |
|---|---|
| `programadecitas-data` | `/app/data` |

Si el volumen ya existe del deploy anterior, los datos están intactos.
Si es un deploy limpio, se creará vacío y el seed lo inicializa.

---

## 3. Forzar rebuild y reinicio

En EasyPanel → programadecitas → hacer click en **Deploy** (o **Rebuild & Restart**).

EasyPanel:
1. Clona el repo desde GitHub (rama `main`)
2. Ejecuta `docker build`
3. Detiene el contenedor anterior
4. Inicia el nuevo contenedor con las variables y el volumen

Tiempo estimado: **2–4 minutos**.

---

## 4. Backup de SQLite antes del deploy (recomendado)

Antes de hacer Rebuild, abrir la consola del contenedor actual y ejecutar:

```bash
cp /app/data/repair.sqlite /app/data/repair.sqlite.bak.$(date +%s)
```

Esto crea un backup con timestamp. No afecta al contenedor en ejecución.

---

## 5. Ejecutar migraciones y seed después del primer deploy

Abrir EasyPanel → programadecitas → **Console** (terminal del contenedor).

Ejecutar en orden:

```bash
# 1. Aplicar migraciones (crea/actualiza tablas)
npm run migrate

# 2. Crear usuario admin si no existe
npm run seed:admin
```

**Outputs esperados:**

```
[migrate] done
[seed] admin user created: gofixcompany@gmail.com
# o si ya existe:
[seed] admin already exists: gofixcompany@gmail.com
```

> En deploys posteriores (updates de código), estos comandos son idempotentes —
> se pueden correr sin riesgo aunque el admin ya exista.

---

## 6. Seguir los logs en vivo

EasyPanel → programadecitas → **Logs**.

Líneas que confirman éxito:

```
SQL connected (sqlite)
[seed] admin already exists: gofixcompany@gmail.com
API listening on http://localhost:4000
```

Si ves:
- `[seed] admin user created:` → primer arranque, todo bien
- `MongoDB unavailable` → normal si MONGODB_URI no está seteado
- `Port 4000 is already in use` → EasyPanel está reiniciando, esperar 10 s

---

## Rollback

### Opción 1 — Volver al commit anterior desde git

```bash
# En tu laptop (no en el servidor)
git log --oneline -10          # identificar el commit estable
git revert HEAD                # reversa del último commit (crea un nuevo commit)
git push origin main           # subir la reversa
# Luego: EasyPanel → Deploy
```

### Opción 2 — Rollback desde EasyPanel

EasyPanel guarda las últimas imágenes Docker construidas.
En EasyPanel → programadecitas → **Deployments** → hacer click en el deployment
anterior → **Redeploy**.

Esto no requiere git y es instantáneo (reutiliza la imagen cacheada).

### Opción 3 — Restaurar SQLite desde backup

Si los datos se corrompieron:

```bash
# Dentro del contenedor (EasyPanel Console):
ls /app/data/                                # ver backups disponibles
cp /app/data/repair.sqlite.bak.<timestamp> /app/data/repair.sqlite
```

Luego reiniciar el contenedor desde EasyPanel.

---

## Variables de entorno — resumen rápido para pegar en EasyPanel

```
NODE_ENV=production
PORT=4000
SQL_DIALECT=sqlite
SQL_STORAGE=./data/repair.sqlite
JWT_SECRET=CAMBIA_ESTO_POR_64_CHARS_ALEATORIOS
JWT_EXPIRES_IN=7d
SEED_ADMIN_NAME=Administrador
SEED_ADMIN_EMAIL=gofixcompany@gmail.com
SEED_ADMIN_PASSWORD=CAMBIA_ESTO
SEED_ADMIN_SCOPE=central
FRONTEND_URL=https://gofixcompanymiami.com
ENABLE_PUBLIC_AI_ASSISTANT=false
PORTAL_URL=https://gofixcompanymiami.com/portal
```
