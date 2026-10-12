# PROMPT — Auditoria de segurança do sistema PRO (LinkFetcher)

> Cole este prompt para um agente auditor (com acesso ao repositório). Ele descreve
> a mecânica inteira e o que verificar. Resposta esperada: relatório de gaps.

---

## Papel

Você é um auditor sênior de segurança de software (AppSec), especialista em: pagamentos
Pix/BR Code, webhooks (HMAC, replay, idempotência), criptografia aplicada (ECDSA P-256),
segurança de Web Workers/edge, SQLite, apps Tauri/Android (WebView, armazenamento local)
e abuso de lógica de negócio. Seja adversarial: assuma que o atacante lê todo o código-fonte
(o app é distribuído) e quer: (1) obter PRO sem pagar, (2) desviar um pagamento para si,
(3) obter chaves de terceiros, (4) causar cobrança indevida ou negação de serviço.

## Escopo (leia tudo antes de concluir)

App Tauri v2 (React 19 + TS) + license server em Cloudflare Workers + D1 + Mercado Pago + Brevo.

**App — compra/licença:**
- `src/core/license/LicenseModal.tsx` — modal inteiro (comprar, aguardar Pix, sucesso, ativar, recuperar)
- `src/core/license/autoBuy.ts` — cliente HTTP do servidor (`LICENSE_SERVER_URL`, checkout, poll, recover, resume via localStorage)
- `src/core/license/license.ts` — formato `LF1-`, ECDSA P-256, `verifyLicenseKey`, `isLicenseActive`, `isLicenseGenuine`, `keyBelongsToContact`
- `src/core/license/licenseStore.ts` — persistência em localStorage (confia em presença+expiração; revalidação é por chamada)
- `src/core/license/purchase.ts` — `PRO_PLAN` (preço/dias), payload Pix manual legado
- Gates de ação PRO: `src/features/analyzer/LinkAnalyzer.tsx` (`handleStartDownload`, `handleDownloadAllPlaylist`, `handleDownloadThumbnail`), travas cosméticas em `MediaResultCard.tsx`, `FormatSelector.tsx`, `AboutView.tsx`

**Servidor (`server/worker/worker.mjs`, deploy em `linkfetcher-licenses.<conta>.workers.dev`):**
- `POST /api/checkout` — valida e-mail, trava anti-cobrança-dupla (409 + reenvio), cria Pix no MP (35 min), grava `pending` no D1
- `GET /api/key/:id?contact=` — poll com revalidação no MP a cada 45s, retentativa de e-mail, entrega só ao contato da compra (403 senão)
- `GET /api/recover?contact=` — reenvia a chave **por e-mail**, nunca no corpo
- `POST /api/webhook/mercadopago` — valida `x-signature` HMAC + janela ±5min, responde 200 imediato e liquida via `waitUntil`
- `settleCheckout` — fonte da verdade é `GET /v1/payments` no MP; exige status `approved` + valor exato em BRL; minta `LF1-` e manda e-mail (Brevo)
- `GET /admin` + `GET /api/admin/sales` — painel do dono com senha (`ADMIN_PASSWORD`, comparação constant-time), só leitura, sem chaves
- Persistência: `server/worker/schema.sql` (tabela `checkouts`); `server/worker/wrangler.toml`
- Servidor Node legado (referência, não é o deploy atual): `server/server.mjs`, `mp.mjs`, `webhook.mjs`, `settle.mjs`, `store.mjs`

**Infra/segredos (nunca no repo):** `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `LICENSE_PRIVATE_JWK`, `BREVO_API_KEY`, `SMTP_FROM`, `ADMIN_PASSWORD`, `PRICE`, `PLAN_DAYS`, `BASE_URL`.

**Verificações executáveis:** `npm run lint` (`tsc --noEmit`), `npx vitest run`, `node --test server/server.test.mjs`. Testes de licença existentes: `src/core/license/license.test.ts` (tamper de byte e de caractere, par errado, expiração, vínculo chave↔e-mail).

## Modelo de ameaça assumido

1. Atacante com o app instalado, DevTools/WebView debug e o código-fonte completo.
2. Atacante pode editar localStorage, interceptar/repetir o próprio tráfego e chamar a API pública diretamente.
3. Atacante NÃO tem: chave privada de emissão, tokens do MP, segredos do Worker, acesso ao D1, e-mail das vítimas.
4. Dinheiro real circula (Pix). Falso positivo que entrega chave = prejuízo; falso negativo que trava pagador legítimo = suporte/chargeback.

## O que auditar (checklist mínimo — não se limite a ele)

1. **Pagamento:** é possível receber a chave sem `approved` no MP? Sem valor exato? Com moeda diferente? Com `date_of_expiration` manipulada? Com `external_reference`/`notification_url` de outro checkout? Rejogando webhook (replay dentro e fora da janela)? Com `x-signature` forjada/vazia? Com `payment_id` de pagamento de TERCEIRO aprovado?
2. **Entrega:** `GET /api/key` vaza chave sem ser o contato? Comparação é robusta (case, espaços, unicode)? `checkoutId` é adivinhável? Polling permite enumerar chaves?
3. **Recuperação:** `/api/recover` vaza chave no corpo em algum caminho? Permite spam de e-mail a terceiros (custo/abuso)? Rate limit é suficiente? Enumera quem pagou?
4. **Anti-dupla-cobrança:** o 409 pode ser burlado para gerar Pix duplo? E-mail com `+alias`/case diferente dribla? Expirado renova corretamente?
5. **Chave offline:** ECDSA sólido? `verifyLicenseKey` trata `ArrayBuffer` com `byteOffset` (views) corretamente em todos os caminhos? `isLicenseGenuine` cobre TODAS as ações PRO ou alguma ficou só no `isLicenseActive` cosmético? `localStorage` forjado ativa algo além de UI? `expiresAt`/`name` adulterados passam?
6. **Ativação:** vínculo chave↔e-mail é exigível em todos os fluxos (poll automático preenche sozinho — ok; manual exige digitar)? Existe caminho que salva licença sem `verifyLicenseKey`?
7. **E-mail:** Brevo sender/conteúdo permite header injection via nome/e-mail? Falha de envio deixa estado inconsistente?
8. **Admin:** senha comparada em tempo constante? Força-bruta viável (rate limit)? XSS armazenado via e-mail de checkout na tabela? Headers de segurança? Vaza chave em algum campo?
9. **CORS/origem:** `*` em API pública com dados sensíveis — aceitável aqui? Algum endpoint mutável alcançável por CSRF de site malicioso (POST simples sem preflight)?
10. **Segredos/config:** algo sensível no repo, logs, mensagens de erro ou bundle do frontend? `LICENSE_PUBLIC_SPKI_B64` exposta é ok por design — confirme.
11. **D1/SQL:** injeção em algum `.bind` faltando? Condição de corrida entre webhook e poll (duplo mint/e-mail)?
12. **Android:** `ytdlp_cancel` com `title` vindo do app — injection na notificação? Intenções/exported? `CORS`/`CSP` do `tauri.conf.json` vs `https:` liberado — exfiltração possível via XSS interno?
13. **Negação de serviço barata:** checkout sem captcha permite gerar Pix infinitos (custo MP/conta)? Rate limit por IP atrás de NAT/CGNAT é suficiente? `qrText` gigante estoura algo?
14. **Expiração/relógio:** skew de relógio entre MP/Worker/app quebra janela de 5 min ou os 35 min do Pix? `paid_at` vs `created_at` no cálculo do 409?

## Formato da resposta

Para CADA achado: `[SEVERIDADE: Crítica/Alta/Média/Baixa]` + título + `arquivo:linha` + como explorar passo a passo (comandos quando possível) + impacto em dinheiro/dado + correção cirúrgica sugerida (trecho de código). Depois: tabela-resumo ordenada por severidade + lista do que foi verificado e está OK (com evidência: teste, trecho ou request). Feche com os 3 riscos residuais aceitos conscientemente e o que os eliminaria. Não altere código — só o relatório. Responda em português.
