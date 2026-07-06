# Integração inbound — Promo Champions ← PromoGifts

Artefatos prontos pra aplicar **no projeto Supabase do Promo Champions**
(`rapjswienfhkobhlamxb`). O projeto PromoGifts (`doufsxqlfjyuvxuezpln`) já está
configurado como emissor: webhook `Promo Champions Sync` cadastrado em
`outbound_webhooks`, assinando `quote.sent` com HMAC-SHA256 do body no header
`x-webhook-signature`.

## Passo a passo (no projeto Promo Champions)

### 1. Cadastrar o secret HMAC
No Dashboard do PC → **Edge Functions → Secrets**, criar:

- **Nome:** `PROMOGIFTS_WEBHOOK_SECRET`
- **Valor:** *mesmo valor* que está em `PROMO_CHAMPIONS_WEBHOOK_SECRET` no
  projeto PromoGifts. Peça ao admin do PromoGifts pra te enviar por canal
  seguro (1Password / Bitwarden). **Não** cole em chat/email.

### 2. Aplicar a migration
Rodar `migration.sql` (deste diretório) via MCP `apply_migration` ou psql.
Cria:
- `public.quotes_inbound` — mirror mínimo do orçamento recebido (upsert por `quote_id`)
- `public.webhook_inbound_dedupe` — dedupe por `correlation_key` (TTL 30d)
- `public.webhook_inbound_log` — auditoria de toda chamada (ok/duplicate/invalid)
- Grants + RLS (service_role only — a edge acessa via service_role)

### 3. Deployar a edge function
Copiar `receive-quote-sync.ts` para
`supabase/functions/receive-quote-sync/index.ts` no repo do PC e deployar.

`verify_jwt = false` no `supabase/config.toml` — a auth é via HMAC:
```toml
[functions.receive-quote-sync]
verify_jwt = false
```

### 4. Validar
```bash
# PromoGifts → /admin/conexões → Entregas: deve ver 200 OK
# PC → tabela quotes_inbound: linha nova/atualizada
# PC → tabela webhook_inbound_log: 1 evento "ok"
# Reenvio manual (mesmo correlation_key): retorna 200 { status: "duplicate_ignored" }
```

## Contratos

### Request (do PromoGifts)
```
POST /functions/v1/receive-quote-sync
Content-Type: application/json
x-webhook-signature: <hex sha256 hmac(body, PROMOGIFTS_WEBHOOK_SECRET)>
x-webhook-event: quote.sent
x-correlation-key: quote:<uuid>:sent:<updated_at>

{
  "event": "quote.sent",
  "correlation_key": "quote:...:sent:...",
  "payload": {
    "quote_id": "uuid",
    "quote_number": "...",
    "status": "sent",
    "client_id": "...",
    "client_name": "...",
    "total": 1234.56,
    "updated_at": "2026-07-06T...",
    "seller_email": "..."
  }
}
```

### Respostas
| Status | Body | Quando |
|---|---|---|
| 200 | `{ ok: true, status: "processed", quote_id }` | Novo/atualizado com sucesso |
| 200 | `{ ok: true, status: "duplicate_ignored", correlation_key }` | Já visto (dedupe) |
| 400 | `{ ok: false, error: "invalid_payload", details }` | Zod falhou |
| 401 | `{ ok: false, error: "hmac_missing" \| "hmac_mismatch" \| "secret_not_configured", hint }` | Auth falhou |
| 500 | `{ ok: false, error: "internal", request_id }` | Erro no PC |
