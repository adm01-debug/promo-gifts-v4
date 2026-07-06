## Objetivo

Corrigir a integração PromoGifts → Promo Champions removendo o passo pelo `webhook-dispatcher` (que envia headers `X-Event`/`X-Signature-256` e envelopa o payload em `data:`) e passando a chamar `receive-quote-sync` do Champions diretamente com o contrato esperado.

## Mudanças

**Arquivo único:** `supabase/functions/quote-sync-promo-champions/index.ts`

Mantém:
- CORS via `buildPublicCorsHeaders`
- Validação JWT do vendedor via `sb.auth.getClaims`
- Schema Zod atual do body de entrada
- Cálculo de `correlation_key = quote:<id>:sent:<updated_at>`

Substitui o bloco que chama `webhook-dispatcher` por:

1. Ler `PROMO_CHAMPIONS_WEBHOOK_SECRET` do env. Se ausente → 503 `service_misconfigured` com hint claro.
2. Montar body canônico:
   ```json
   {
     "event": "quote.sent",
     "correlation_key": "...",
     "payload": { quote_id, quote_number, status, client_id, client_name, total, updated_at, seller_email }
   }
   ```
3. Serializar em string estável e calcular HMAC SHA-256 via `crypto.subtle.importKey` + `sign` com o secret; hex encode.
4. POST para `https://rapjswienfhkobhlamxb.supabase.co/functions/v1/receive-quote-sync` com headers:
   - `Content-Type: application/json`
   - `x-webhook-event: quote.sent`
   - `x-webhook-signature: sha256=<hex>`
   - `x-correlation-key: <correlation_key>`
5. Se `!resp.ok` → devolver `{ ok:false, error:"champions_failed", status, details }` com status upstream.
6. Se ok → `{ ok:true, correlation_key, champions_response: <json ou texto> }`.

Remove: dependência de `WEBHOOK_DISPATCHER_SECRET` neste caminho (o dispatcher continua existindo para outros webhooks cadastrados; só este proxy manual deixa de usá-lo).

## Detalhes técnicos

- URL do Champions fica como constante `CHAMPIONS_URL` no topo do arquivo (documentar que é o project ref `rapjswienfhkobhlamxb`).
- HMAC: usar `TextEncoder` no secret + body; `crypto.subtle.importKey("raw", ..., { name:"HMAC", hash:"SHA-256" }, false, ["sign"])`; converter `ArrayBuffer` em hex.
- Fetch com `AbortSignal.timeout(15000)` para não pendurar a request do frontend.
- Logs estruturados (mantém o padrão que já existe no projeto se aplicável) só em falha, sem vazar secret.

## Fora de escopo

- Não altera `webhook-dispatcher` nem `outbound_webhooks` (o webhook cadastrado no /admin/conexões pode ficar como está, mas ele passará a ser redundante para este evento — decidir depois se remove).
- Não altera frontend (`QuotePromoChampionsSync.ts` continua invocando `quote-sync-promo-champions` com o mesmo body).
- Não altera Zod do body de entrada.

## Verificação

Após deploy:
1. `supabase--curl_edge_functions` em `/quote-sync-promo-champions` com body válido → esperar `{ ok:true, champions_response }`.
2. Conferir do lado Champions se `receive-quote-sync` retornou 200 (ou `duplicate_ignored` se repetido).
