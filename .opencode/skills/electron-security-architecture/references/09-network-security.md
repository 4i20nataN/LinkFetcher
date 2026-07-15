# 09 — Network Security

## Cliente HTTP seguro (wrapper único, reusado em todo o app)
```ts
const SAFE_DEFAULTS = {
  timeoutMs: 15_000,
  maxRedirects: 3,
  minTlsVersion: 'TLSv1.2' as const,
};

async function safeFetch(url: string, allowedHosts: Set<string>): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new SecurityError('insecure_protocol');
  if (!allowedHosts.has(parsed.hostname)) throw new SecurityError('host_not_allowed');
  await assertNotPrivateAddress(parsed.hostname); // proteção SSRF/DNS rebinding, ver abaixo

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), SAFE_DEFAULTS.timeoutMs);
  try {
    const res = await fetch(parsed.toString(), {
      redirect: 'manual', // nunca seguir redirect automaticamente
      signal: controller.signal,
      headers: { 'User-Agent': `LinkFatcher/${APP_VERSION}` },
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      // validar location contra allowedHosts antes de seguir manualmente, com contador de redirects
    }
    return res;
  } finally {
    clearTimeout(t);
  }
}
```

## TLS
- Nunca `rejectUnauthorized: false`, nunca handler de `certificate-error` que aceite (ver `01`).
- Versão mínima TLS 1.2, preferir 1.3 quando suportado pelo endpoint.

## DNS rebinding / SSRF
- Antes de conectar, resolver o hostname e verificar que o IP resultante não é privado/loopback/link-local (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`, `::1`, `fc00::/7`) quando o destino deveria ser um host público conhecido (API do GitHub, CDN de assets) — previne que um DNS malicioso redirecione uma allowlist por nome para um endereço interno.

## Redirects
- `redirect: 'manual'`, seguir manualmente com contador (`maxRedirects`) e revalidação completa da allowlist de host a cada hop — nunca confiar que o destino de um redirect ainda está dentro do domínio original.

## Origin validation
- Para qualquer resposta usada para decisão de segurança (ex.: release do GitHub), validar campos de identidade da resposta (`full_name` do repo) contra constante pinada — não só o host da requisição.

## User-Agent
- Fixo, identificável (`LinkFatcher/<version>`), sem informação de sistema desnecessária (evita fingerprinting do usuário por terceiros).
