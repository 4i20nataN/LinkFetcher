#!/usr/bin/env bash
# Deploy gratuito do License Server numa VPS Ubuntu (testado 22.04/24.04 —
# serve p/ o tier Always Free da Oracle): Node 22 + Caddy (HTTPS automático)
# + systemd. Roda 1x como root. Idempotente (não sobrescreve .env existente).
#
# Uso:
#   DOMAIN=licencas.exemplo.com ACME_EMAIL=voce@email.com \
#   REPO_URL=https://github.com/voce/LinkFetcher-Tauri.git \
#   sudo bash server/deploy-vps.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/linkfetcher}"
APP_USER="${APP_USER:-linkfetcher}"
: "${DOMAIN:?informe DOMAIN=seu.dominio (ex. DuckDNS gratuito)}"
: "${ACME_EMAIL:?informe ACME_EMAIL=email p/ o Let's Encrypt}"
REPO_URL="${REPO_URL:-}"

echo "== pacotes =="
apt-get update -qq
apt-get install -y -qq curl git ufw gnupg gettext-base debian-keyring debian-archive-keyring apt-transport-https > /dev/null

echo "== node 22 =="
if ! command -v node >/dev/null || ! node --version | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null
  apt-get install -y -qq nodejs > /dev/null
fi
node --version

echo "== caddy =="
if ! command -v caddy >/dev/null; then
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy > /dev/null
fi

echo "== usuário e código =="
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
elif [ -n "$REPO_URL" ]; then
  git clone "$REPO_URL" "$APP_DIR"
elif [ ! -d "$APP_DIR/server" ]; then
  echo "ERRO: sem $APP_DIR/.git e sem REPO_URL — clone o repo em $APP_DIR e rode de novo." >&2
  exit 1
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
cd "$APP_DIR/server" && sudo -u "$APP_USER" npm install --omit=dev --no-audit --no-fund

if [ ! -f "$APP_DIR/server/.env" ]; then
  echo "ERRO: crie $APP_DIR/server/.env a partir de server/.env.example (segredos MP + JWK) e rode de novo." >&2
  echo "  (o JWK vai com aspas simples: LICENSE_PRIVATE_JWK='\$(node scripts/export-jwk.mjs)')" >&2
  exit 1
fi
sudo -u "$APP_USER" mkdir -p "$APP_DIR/server/data"

echo "== systemd =="
cp "$APP_DIR/server/linkfetcher-licenses.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now linkfetcher-licenses
sleep 2
curl -fsS http://127.0.0.1:8787/api/health

echo "== caddy ($DOMAIN) =="
[ -f /etc/caddy/Caddyfile ] && cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak.$(date +%s)"
ACME_EMAIL="$ACME_EMAIL" DOMAIN="$DOMAIN" envsubst < "$APP_DIR/server/Caddyfile" > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy

echo "== firewall =="
ufw allow 22/tcp >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
yes | ufw enable >/dev/null 2>&1 || true

echo "OK: https://$DOMAIN/api/health deve responder {\"ok\":true} em ~1min (certificado)."
echo "Proximo: LICENSE_SERVER_URL=https://$DOMAIN no app + rebuild."
