# License Server — Cloudflare Workers + D1 (100% gratuito, sem Oracle/VPS)

Deploy oficial (o Node em `server/server.mjs` é o legado de referência).
Mesma base do legado (checkout Pix, poll, webhook HMAC, ECDSA `LF1-`), mais:
planos múltiplos, anti-cobrança-dupla, recover, painel admin e broadcast.
Roda no free tier da Cloudflare: sem sleep, sem disco, HTTPS automático
em `*.workers.dev`.

## O que você precisa fazer (só conta free + 6 segredos)

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
   # 2. Settings → Senders → Add sender (e-mail de papel) → clique no link de verificação
   # 3. Rode abaixo (cole a API key; SMTP_FROM = o e-mail verificado):
   wrangler secret put BREVO_API_KEY
   wrangler secret put SMTP_FROM
   wrangler secret put ADMIN_PASSWORD
   ```
   Em `wrangler.toml`, `[vars]` leva só `PRICE`, `PLAN_DAYS` e `BASE_URL`
   (nada de e-mail/senha no git).
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
8. **Ligar o app:** `src/core/license/autoBuy.ts` já aponta p/
   `https://linkfetcher-licenses.linkfetcher.workers.dev` — rebuild e pronto.

## Teste sem gastar nada

1. Token de **TESTE** do MP + `wrangler secret put MP_ACCESS_TOKEN` com ele.
2. `wrangler dev` → `POST localhost:8787/api/checkout` com e-mail válido.
3. Simulador de webhook do dashboard do MP → `GET /api/key/:id?contact=...`
   deve voltar `{"status":"paid","key":"LF1-..."}` após aprovação.

## Limites do free (sobra p/ esse uso)

Workers: 100 mil req/dia. D1: 5 GB, 5 mi leituras/dia. Vendas de licença
ficam ordens de magnitude abaixo disso.

## Variáveis e segredos

`[vars]` (em `wrangler.toml`, pode commitar): `PRICE`, `PLAN_DAYS`
(fallback do mensal), `BASE_URL`, `SMTP_FROM` — NÃO, este vai como segredo.

Segredos (`wrangler secret put NOME`, nunca no repo):
`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `LICENSE_PRIVATE_JWK`,
`BREVO_API_KEY`, `SMTP_FROM`, `ADMIN_PASSWORD` (+ `PLANS_JSON` opcional
p/ trocar preços sem redeploy — exige chave `mensal` válida).

Confira com `wrangler secret list`. Precedência de preço:
`PLANS_JSON` > linha do checkout > `[vars]`.

## Rotas (além do checkout/poll/webhook)

- `GET /api/recover?contact=` — reenvia a chave por e-mail (nunca no corpo;
  resposta sempre `sent`, sem oráculo de quem pagou).
- `GET /admin` + `GET /api/admin/sales` — painel do dono (`x-admin-key` =
  `ADMIN_PASSWORD`); sem chaves, só totais e status.
- `POST /api/admin/broadcast` — aviso de update p/ compradores:
```bash
curl -X POST https://SEU-WORKER/api/admin/broadcast \
  -H 'content-type: application/json' -H "x-admin-key: $ADMIN_PASSWORD" \
  -d '{"tag":"v1.5.2","subject":"LinkFetcher v1.5.2 disponível","message":"..."}'
```
Tag idempotente (repetir só envia a quem faltou); teto 300/call (cota do
Brevo grátis). O CI da release chama sozinho quando o secret
`ADMIN_PASSWORD` existe no GitHub.

## Banco (D1)

Aplicar o schema 1x (e reaplicar a cada mudança — tudo `IF NOT EXISTS`):
`wrangler d1 execute linkfetcher-licenses --file=./schema.sql`
Tabelas: `checkouts` (+ coluna `plan`), `broadcasts`, `broadcast_sends`.
