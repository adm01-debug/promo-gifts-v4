## Contexto

Boa notícia: o projeto **já tem** uma primitiva de rate limit funcionando — `supabase/functions/_shared/rate-limiter.ts` + RPC `public.check_edge_rate_limit(p_key, p_window_ms, p_max_requests)`. Não precisamos criar tabela nem função nova (respeitando a regra "PROIBIDO criar coisas novas no Lovable Cloud interno").

`request_rate_limits` e `edge_rate_limits` existem, mas o caminho canônico é a RPC acima (usada pela classe `RateLimiter`). Vou usá-la.

## Regra proposta

- **Chave:** `quote-sync-pc:{sellerId}:{quoteId}`
- **Limite:** 10 chamadas por hora (`maxRequests: 10`, `windowMs: 3_600_000`)
- **Fail-open** (se a RPC falhar, permite — não bloqueia o vendedor por falha de infra; alinhado ao padrão `ai`/`search`)
- **Escopo por seller+quote** → um vendedor não afeta os outros, e um mesmo quote não pode ser sincronizado > 10x/h; múltiplos quotes do mesmo seller continuam livres.

## Ordem no fluxo

Rate limit roda **depois** de:
1. Auth (JWT válido) — para termos `sellerId` real
2. Zod (body válido) — para termos `quote_id`
3. Secret presente

E **antes** de:
4. Fetch do quote (ownership) — economiza roundtrip ao DB quando bloqueado
5. UPDATE `quotes.status='sent'`
6. POST ao Champions

## Mudanças

**Arquivo único:** `supabase/functions/quote-sync-promo-champions/index.ts`

1. Adicionar import: `import { RateLimiter } from "../_shared/rate-limiter.ts";`
2. Criar instância module-level:
   ```ts
   const syncRateLimiter = new RateLimiter({
     maxRequests: 10,
     windowMs: 60 * 60 * 1000,
     keyPrefix: "quote-sync-pc",
   });
   ```
3. Após validar Zod + secret, antes do fetch do quote:
   ```ts
   const rl = await syncRateLimiter.check(`${sellerId}:${q.quote_id}`);
   if (!rl.allowed) {
     return new Response(
       JSON.stringify({
         error: "rate_limited",
         hint: "Limite de 10 sincronizações por hora para este orçamento. Tente novamente em instantes.",
         reset_at: new Date(rl.resetAt).toISOString(),
       }),
       {
         status: 429,
         headers: {
           ...cors,
           "Content-Type": "application/json",
           "X-RateLimit-Limit": "10",
           "X-RateLimit-Remaining": String(rl.remaining),
           "X-RateLimit-Reset": String(rl.resetAt),
           "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
         },
       },
     );
   }
   ```
   Obs.: como `sellerId` só existe após o `getClaims`, movo esse trecho para depois do auth (é onde já está o restante da lógica). O nome `sellerId` já é declarado no arquivo hoje.

**Zero mudanças de schema.** Zero migrations. Nada novo criado.

## Frontend

Nenhuma mudança obrigatória. O erro 429 já é tratado pelo hook de sync (mostra toast de erro). Se quiser copy dedicada, tratamos numa iteração futura — fora de escopo aqui.

## Testes

Estender `supabase/functions/quote-sync-promo-champions/index.test.ts`:

1. **Interceptar a RPC `check_edge_rate_limit`** no fetch stub (`POST /rest/v1/rpc/check_edge_rate_limit` → devolve `[{ allowed, remaining, reset_at }]`).
2. Novos casos:
   - **rate limit: allowed=true** → happy path continua 200 (garante que o header `x-correlation-key` sai normal e Champions foi chamado).
   - **rate limit: allowed=false** → responde 429 com `error="rate_limited"`, `Retry-After` numérico, e **NÃO** chama Champions nem faz PATCH em `quotes`.
   - **rate limit RPC falha** (stub devolve 500) → fail-open, fluxo continua até Champions (200).
3. Atualizar os casos existentes (happy path, re-envio, 401 do Champions, updated_at ausente, ownership 403, 404 quote_not_found) para o stub devolver `allowed=true` por padrão — sem mudanças em asserts.

## Verificação

- Rodar `supabase--test_edge_functions` (todos os 12 + 3 novos casos verdes).
- Manualmente: sincronizar o mesmo orçamento 11x seguidas → 11ª retorna 429 com `Retry-After`.

## Fora de escopo

- Cleanup automático da tabela `edge_rate_limits` (já existe `cleanup_expired_edge_rate_limits`).
- Alertas Sentry para picos de 429.
- Rate limit global por IP (a RPC opera por chave; se quiser cobertura por IP, é outra iteração).
