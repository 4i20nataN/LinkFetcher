# License Server — Cloudflare Workers + D1 (100% gratuito, sem Oracle/VPS)

Mesma API do `server/server.mjs`, mas roda no free tier da Cloudflare:
sem sleep, sem disco, HTTPS automático em `*.workers.dev`.

## O que você precisa fazer (só conta free + 3 segredos)

1. **Cloudflare (grátis, sem cartão):** crie a conta em `dash.cloudflare.com` →
   Workers & Pages. Instale 1x: `npm i -g wrangler && wrangler login`.
2. **D1 (banco grátis):**
   ```
   cd server/worker
   wrangler d1 create linkfetcher-licenses   # copie o database_id p/ wrangler.toml
   wrangler d1 execute linkfetcher-licenses --file=./schema.sql
   ```
3. **Mercado Pago (só taxa por venda, sem mensalidade):**
   - Dashboard do vendedor → Suas integrações → Credenciais → **Access Token de produção** → segredo `MP_ACCESS_TOKEN`.
   - Cadastre sua **chave Pix** na conta (exigido p/ vender via Pix).
4. **Chave de emissão (1x, na sua máquina — igual ao VPS):**
   ```
   node scripts/mint-key.mjs --init   # gera signing-keys/license.key
   node scripts/export-jwk.mjs         # saída em linha única → LICENSE_PRIVATE_JWK
   ```
   A pública correspondente vai em `LICENSE_PUBLIC_SPKI_B64` no app.
5. **Segredos no Worker (nunca no repo):**
   ```
   cd server/worker
   wrangler secret put MP_ACCESS_TOKEN
   wrangler secret put MP_WEBHOOK_SECRET      # provisório; troca no passo 7
   wrangler secret put LICENSE_PRIVATE_JWK
   # E-mail OBRIGATÓRIO (Brevo grátis: 300/dia, sem domínio):
   # 1. Crie a conta em brevo.com → Settings → SMTP & API → Generate API key
   # 2. Settings → Senders → Add sender (seu Gmail) → clique no link de verificação
   # 3. Rode abaixo (cole a API key; SMTP_FROM = o Gmail verificado):
   wrangler secret put BREVO_API_KEY
   ```
   Em `wrangler.toml`, ajuste `[vars]` (`PRICE`, `PLAN_DAYS`, `SMTP_FROM`
   = seu Gmail verificado no Brevo).
6. **Deploy:**
   ```
   cd server/worker
   wrangler deploy   # anote https://linkfetcher-licenses.<sua-conta>.workers.dev
   curl https://<seu-worker>/api/health   # {"ok":true}
   ```
   Depois do 1º deploy, opcional: fixe `BASE_URL = "https://<seu-worker>"` no
   `wrangler.toml` e dê `wrangler deploy` de novo (trava a `notification_url`).
7. **Webhook no MP:** no dashboard, cadastre
   `https://<seu-worker>/api/webhook/mercadopago` p/ eventos de **pagamento**,
   copie o **segredo** → `wrangler secret put MP_WEBHOOK_SECRET` → redeploy.
8. **Ligar o app:** em `src/core/license/autoBuy.ts`, preencha
   `LICENSE_SERVER_URL = 'https://<seu-worker>'` e rebuild. Com vazio, o app
   continua no modo manual (QR próprio).

## Teste sem gastar nada

1. Token de **TESTE** do MP + `wrangler secret put MP_ACCESS_TOKEN` com ele.
2. `wrangler dev` → `POST localhost:8787/api/checkout` com e-mail válido.
3. Simulador de webhook do dashboard do MP → `GET /api/key/:id?contact=...`
   deve voltar `{"status":"paid","key":"LF1-..."}` após aprovação.

## Limites do free (sobra p/ esse uso)

Workers: 100 mil req/dia. D1: 5 GB, 5 mi leituras/dia. Vendas de licença
ficam ordens de magnitude abaixo disso.
