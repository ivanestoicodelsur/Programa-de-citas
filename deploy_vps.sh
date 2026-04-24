#!/usr/bin/env bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────
VPS_USER="root"
VPS_HOST="187.77.212.112"
VPS_PASS='8IGnjcKCG76PNL)B.m-W'
REMOTE_DIR="/root/backend"
APP_NAME="repair-services-backend"
CONTAINER_PORT=4000
HOST_PORT=4000
DATA_VOLUME="${APP_NAME}-data"

# ── Preflight ─────────────────────────────────────────────
if ! command -v sshpass &>/dev/null; then
  echo "⚠  sshpass not found. Installing..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get install -y sshpass
  elif command -v pacman &>/dev/null; then
    sudo pacman -S --noconfirm sshpass
  elif command -v brew &>/dev/null; then
    brew install hudochenkov/sshpass/sshpass
  else
    echo "ERROR: Install sshpass manually and retry."
    exit 1
  fi
fi

SSH_CMD="sshpass -p '${VPS_PASS}' ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST}"
RSYNC_PASS="sshpass -p '${VPS_PASS}'"

echo "==> Syncing code to ${VPS_HOST}:${REMOTE_DIR} ..."

$RSYNC_PASS rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude .env \
  --exclude 'data/*.sqlite' \
  -e "ssh -o StrictHostKeyChecking=no" \
  "$(dirname "$0")/" \
  "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/"

echo "==> Building Docker image on VPS ..."

$SSH_CMD bash -s <<REMOTE
  set -euo pipefail
  cd ${REMOTE_DIR}

  echo "-- Building image ..."
  docker build -t ${APP_NAME}:latest .

  echo "-- Ensuring data volume exists ..."
  docker volume create ${DATA_VOLUME} 2>/dev/null || true

  echo "-- Stopping old container (if any) ..."
  docker rm -f ${APP_NAME} 2>/dev/null || true

  echo "-- Starting new container ..."
  docker run -d \
    --name ${APP_NAME} \
    --restart unless-stopped \
    -p ${HOST_PORT}:${CONTAINER_PORT} \
    -v ${DATA_VOLUME}:/app/data \
    --env-file ${REMOTE_DIR}/.env \
    ${APP_NAME}:latest

  echo "-- Pruning dangling images ..."
  docker image prune -f

  echo "-- Container status:"
  docker ps --filter "name=${APP_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
REMOTE

echo ""
echo "==> Deploy complete!  http://${VPS_HOST}:${HOST_PORT}"
