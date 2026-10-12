# Como funciona a compra do PRO — do botão até a chave

Documento em linguagem simples. Ordem real dos acontecimentos, sem pular etapa.

## As 5 peças

| Peça | O que é | Quanto custa |
|---|---|---|
| App (celular/PC) | Tela de compra, QR e ativação | — |
| Worker (Cloudflare) | Robô que cria o Pix, confirma o pagamento e emite a chave. Endereço: `https://linkfetcher-licenses.linkfetcher.workers.dev` | R$ 0 |
| D1 (banco) | Caderninho do robô: cada tentativa de compra, paga ou não, fica gravada pra sempre | R$ 0 |
| Mercado Pago | Quem gera o Pix e recebe o dinheiro na sua conta | Só taxa por venda |
| Brevo | Quem manda a chave por e-mail (300/dia grátis) | R$ 0 |

## Passo a passo da compra

1. O usuário digita o **e-mail** e toca **Comprar — R$ 9,99**.
2. O app pede ao Worker: "crie uma cobrança pra este e-mail" (`POST /api/checkout`).
3. Antes de tudo, o Worker olha o caderninho: **esse e-mail já tem PRO válido?** Se sim, **não gera cobrança nova** — reenvia a chave por e-mail e avisa na tela. (Sem essa trava, o cliente pagava 2x sem querer.)
4. Se não tem, o Worker pede ao Mercado Pago um **Pix de R$ 9,99 válido por 35 minutos** e grava a tentativa como `pending` (pendente).
5. O app mostra o **QR + código copia-e-cola**. Na tela aparece "Confira no banco: R$ 9,99 para LinkFetcher" — o cliente confere valor e recebedor antes de pagar (é assim que se evita golpe de QR trocado).
6. O cliente paga no banco. A cada 5 segundos o app pergunta ao Worker: "já pagou?" (`GET /api/key/...`).
7. O Mercado Pago avisa o Worker sozinho (`webhook`). O Worker confere a **assinatura do aviso** (carimbo do MP), responde "recebi" em segundos e só depois vai conferir de verdade.
8. Conferência de verdade: o Worker pergunta **ao MP** (nunca acredita só no aviso) se o pagamento foi **aprovado**, em **reais** e no **valor exato** (R$ 9,99, nem 1 centavo a menos).
9. Tudo certo: o Worker **cria a chave** (`LF1-...`, assinada, válida por 30 dias, com o e-mail do comprador gravado dentro) e grava como `paid` (pago).
10. A chave chega por **3 caminhos ao mesmo tempo**: aparece na tela (com botão de copiar e baixar `.txt`), **vai pro e-mail** e o app ativa sozinho. Fechou o app no meio? Reabrindo tem botão **Continuar último pagamento**.

## Se algo der errado

| Situação | O que acontece |
|---|---|
| Pix expira (35 min) | A tela avisa e pede pra gerar outro. Nenhuma cobrança existe. |
| Pagamento recusado/cancelado | A tela avisa. Nenhuma chave é criada. |
| Valor veio diferente | Vira `amount_mismatch`, chave bloqueada, tela manda falar com o suporte. |
| Internet caiu na hora | O aviso do MP é reenviado sozinho; o app tenta de 5 em 5 s. Quando voltar, conclui. |
| App fechado após pagar | Botão de continuar + e-mail com a chave. |
| E-mail falhou | O Worker tenta de novo a cada consulta, e a tela de recuperação reenvia. |
| Trocou de celular / formatou | Tela "Perdi minha chave": digita o e-mail da compra e recebe de novo. A ativação exige **chave + e-mail juntos**. |
| Digitou e-mail com PRO válido e tocou comprar | Não cobra de novo: reenvia a chave e mostra até quando vale. |

## Como cada golpe é barrado

- **Pix falso / QR trocado:** o QR nasce no Mercado Pago (dinâmico e assinado por eles); a tela mostra valor + recebedor pra conferir; o servidor só libera a chave após confirmar o pagamento **direto na API do MP**.
- **Aviso falso de pagamento:** o webhook exige o carimbo HMAC do MP (com validade de 5 min). Sem carimbo, é ignorado.
- **Mudança de valor:** só aprova centavo exato em BRL.
- **Chave chutada/adulterada:** a chave é assinada (ECDSA P-256). Trocar 1 letra quebra a assinatura e o app recusa — tem teste automatizado que prova.
- **Chave alheia:** a ativação exige o e-mail gravado dentro da chave.
- **Reenvio pra estranho:** a recuperação **manda e-mail, nunca mostra a chave na tela** — chutar um e-mail não entrega nada a ninguém.
- **Cópia do cofre do app:** o app regrava a assinatura a cada ação PRO (download personalizado, capa, lote). Arquivo forjado é expulso na hora.
- **Cobrança duplicada:** a mesma pessoa não paga 2x sem querer (item 3 acima).
- **Chave privada:** mora só como segredo no Worker, nunca no código. Cada entrega é auditável no banco.

## Operação (dono)

- **Ver vendas:** `npx wrangler d1 execute linkfetcher-licenses --remote --command="SELECT email,status,price,paid_at FROM checkouts ORDER BY created_at DESC LIMIT 20"` (com `--config wrangler.toml` dentro de `server/worker`).
- **Comprovante oficial:** extrato do Mercado Pago (vale fiscalmente).
- **Trocar preço:** mudar `PRICE`/`PLAN_DAYS` no `wrangler.toml` **e** `PRO_PLAN` no app juntos + deploy + rebuild.
- **Trocar segredos:** `wrangler secret put NOME --config wrangler.toml` + deploy. Sempre com `--config`, porque existe um `wrangler.jsonc` fantasma na raiz que sequestra o comando.
- **E-mail parou:** conferir `BREVO_API_KEY` e remetente verificado; o log do Worker diz `email ...` o motivo.

## Limites honestos

- A verificação da chave é offline: com chave + e-mail em mãos, dá pra ativar em vários aparelhos. O teto de aparelhos com checagem online ficou pro futuro (só se houver abuso real).
- A recuperação confirma que o e-mail **comprou**, não que quem digitou **é o dono** do e-mail (padrão de mercado para produto barato; o e-mail com a chave só chega ao dono).
