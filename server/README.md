# License Server — venda automática PRO via Mercado Pago Pix

## 1. Mercado Pago (dashboard do vendedor)
1. Crie a aplicação e pegue o **Access Token de produção** → `MP_ACCESS_TOKEN`
2. Cadastre o webhook `https://SEU-SERVIDOR/api/webhook/mercadopago` p/ eventos
   de **pagamento** e copie o **segredo** → `MP_WEBHOOK_SECRET`
3. Cadastre sua chave Pix na conta (exigido p/ vender via Pix)

## 2. Chave de emissão (1x, na sua máquina)
`node scripts/mint-key.mjs --init` gera `signing-keys/license.key`.
Converta a privada p/ JWK de linha única e cole em `LICENSE_PRIVATE_JWK`:
`node -e "console.log(JSON.stringify(require('./signing-keys/license.key').privateJwk))"`
A pública correspondente vai em `LICENSE_PUBLIC_SPKI_B64` no app.

## 3. Subir
```
cp server/.env.example server/.env  # preencher
node server/server.mjs
```
Qualquer VPS/PaaS com Node 22 serve (Fly.io, Railway, VPS). HTTPS obrigatório
(o MP só chama webhook em HTTPS). Dados em `server/data/db.json` (gitignored).

## 4. Ligar o app
Em `src/core/license/autoBuy.ts`, preencha `LICENSE_SERVER_URL` com o HTTPS
acima e rebuild. Com vazio, o app usa só a compra manual (QR próprio).

## Segurança
- Webhook validado por `x-signature` (HMAC + ts ±5min); sem segredo = 500
- Pagamento revalidado no MP (fonte da verdade); valor tem que ser EXATO
- Chave entregue só ao contato da compra; idempotente por pagamento
- Testes: `node --test server/server.test.mjs`
