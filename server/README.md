# License Server — venda automática PRO via Mercado Pago Pix

## 1. Mercado Pago (dashboard do vendedor)
1. Crie a aplicação e pegue o **Access Token de produção** → `MP_ACCESS_TOKEN`
2. Cadastre o webhook `https://SEU-SERVIDOR/api/webhook/mercadopago` p/ eventos
   de **pagamento** e copie o **segredo** → `MP_WEBHOOK_SECRET`
3. Cadastre sua chave Pix na conta (exigido p/ vender via Pix)

## 2. Chave de emissão (1x, na sua máquina)
`node scripts/mint-key.mjs --init` gera `signing-keys/license.key`.
Exporte a privada p/ JWK de linha única e cole em `LICENSE_PRIVATE_JWK`:
`node scripts/export-jwk.mjs`
A pública correspondente vai em `LICENSE_PUBLIC_SPKI_B64` no app.

## 3. Subir
```
cp server/.env.example server/.env  # preencher (sem dotenv: exporte antes)
set -a; . server/.env; set +a
node server/server.mjs
```
Qualquer VPS/PaaS com Node 22 serve. HTTPS obrigatório (o MP só chama
webhook em HTTPS). Dados em `server/data/db.json` (gitignored).

## 3b. Deploy 100% gratuito (Oracle Always Free + Caddy)
VM permanente grátis + HTTPS automático + disco local (sem sleep, sem
perder vendas — Render/Railway gratuitos dormem e não têm disco):
1. Crie a VM Always Free (Ubuntu 24.04) e um subdomínio gratuito (DuckDNS)
   apontando p/ o IP dela; libere as portas 80/443 no security list.
2. Na VM, como root:
```
DOMAIN=seu-sub.duckdns.org ACME_EMAIL=voce@email.com \
REPO_URL=https://github.com/voce/LinkFetcher-Tauri.git \
bash server/deploy-vps.sh
```
   (sem REPO_URL: clone o repo em `/opt/linkfetcher` antes).
3. Crie `/opt/linkfetcher/server/.env` a partir de `server/.env.example`
   (JWK entre aspas simples) e rode o script de novo — ele valida
   `https://SEU-DOMINIO/api/health` no final.

## 4. Ligar o app
Em `src/core/license/autoBuy.ts`, preencha `LICENSE_SERVER_URL` com o HTTPS
acima e rebuild. Com vazio, o app usa só a compra manual (QR próprio).

## Segurança
- Webhook validado por `x-signature` (HMAC + ts ±5min); sem segredo = 500
- Pagamento revalidado no MP (fonte da verdade); valor tem que ser EXATO
- Chave entregue só ao contato da compra; idempotente por pagamento
- Testes: `node --test server/server.test.mjs`

## Teste local (sem gastar nada)
1. `node scripts/mint-key.mjs --init` (pública no app, privada no .env)
2. `cp server/.env.example server/.env` (preencha; MP_* pode ser fictício p/ UI)
3. `node server/server.mjs` → `curl localhost:8787/api/health` → `{"ok":true}`
4. No app: `LICENSE_SERVER_URL='http://localhost:8787'` (`src/core/license/autoBuy.ts`)
   e rode — o botão de Pix automático aparece (gerar cobra o MP de verdade,
   então sem token válido ele erra — esperado)
5. Webhook de verdade sem VPS: `cloudflared tunnel --url http://localhost:8787`
   → URL https pública → use em `BASE_URL`, no webhook do MP e no app.
   Com token de TESTE do MP + simulador de webhook do dashboard dá pra
   percorrer o ciclo inteiro sem mover dinheiro.
