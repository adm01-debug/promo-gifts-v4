# Contract migration guide

Como migrar uma Edge Function legada para o pacote `_shared/contracts`.

---

## Quando migrar

Se sua função:

- Recebe payload externo via `req.json()` ou `req.text()`, **e**
- Não usa `parseContract`,

então ela é candidata. Auditoria 2026-05-21 listou 14 candidatas; abaixo a
lista priorizada.

Status 2026-05-24: os lotes P0, P1 e P2 abaixo já estão migrados para
`parseContract`. A lista fica como histórico de escopo e referência para
novos endpoints.

### P0 (migradas)

1. `send-transactional-email` — sem nenhuma validação runtime
2. `kit-ai-builder` — payload livre vai direto pro modelo
3. `market-intelligence-insights` — idem
4. `bi-copilot` — query SQL aceita string livre
5. `step-up-verify` — fluxo de autenticação sensível

### P1 (migradas)

6. `ownership-audit`
7. `ownership-repair`
8. `simulation-orchestrator`
9. `sync-external-db`
10. `trends-insights`

### P2 (migradas; já tinham guarda parcial)

11. `force-global-logout`
12. `e2e-cleanup`
13. `block-ip-temporarily`

---

## Receita em 5 passos

### 1. Criar o schema

`supabase/functions/_shared/contracts/schemas/<endpoint>.ts`:

```ts
import { z } from 'https://esm.sh/zod@3.23.8';

export const SendEmailV1 = z.object({
  event_type: z.enum(['quote_sent', 'quote_approved', 'quote_rejected', 'order_created']),
  recipient_email: z.string().email().max(255),
  recipient_name: z.string().max(150).optional(),
  data: z.record(z.unknown()),
});

export const SendEmailV2 = SendEmailV1.extend({
  idempotency_key: z.string().uuid(),
}).strict();

export const SendTransactionalEmailSchemas = {
  name: 'send-transactional-email',
  versions: { '1': SendEmailV1, '2': SendEmailV2 },
  defaultVersion: '1' as const,
  deprecated: [{ version: '1', sunset: '2026-10-31', migrationUrl: '...' }],
};
```

### 2. Importar no index.ts

```ts
import { parseContract } from '../_shared/contracts/index.ts';
import { SendTransactionalEmailSchemas } from '../_shared/contracts/schemas/send-transactional-email.ts';
```

### 3. Substituir o parsing manual

**Antes:**

```ts
const body = await req.json();
if (!body.event_type) {
  return new Response(JSON.stringify({ error: 'event_type required' }), { status: 400 });
}
```

**Depois:**

```ts
const result = await parseContract(req, SendTransactionalEmailSchemas, { corsHeaders });
if (!result.ok) return result.response;
const { version, data, responseHeaders } = result;
```

### 4. Anexar headers de versionamento nas respostas de sucesso

```ts
const okHeaders = { ...corsHeaders, ...responseHeaders, 'Content-Type': 'application/json' };
return new Response(JSON.stringify({ ok: true }), { headers: okHeaders });
```

### 5. Adicionar testes em `tests/contracts/`

Veja `tests/contracts/product-webhook.contract.test.ts` como template.
Mínimo de 5 cenários: válido v1, válido v2, missing field, wrong type, version negotiation.

---

## Casos especiais

### Função que precisa do raw body (HMAC, signing)

Use `prereadBody` para evitar ler o stream duas vezes:

```ts
const rawBody = await req.text(); // lê 1x para HMAC
// ...calcula assinatura usando rawBody...

const result = await parseContract(req, MySchemas, {
  corsHeaders,
  prereadBody: rawBody, // helper reusa o que já foi lido
});
```

Padrão usado em `webhook-inbound` migrado neste PR.

### Função com múltiplos verbos (action / mode)

Use **discriminated union** em v2:

```ts
export const MyV2 = z.discriminatedUnion('mode', [
  z
    .object({
      mode: z.literal('create'),
      data: z.object({
        /* ... */
      }),
    })
    .strict(),
  z.object({ mode: z.literal('delete'), id: z.string().uuid() }).strict(),
]);
```

Padrão usado em `webhook-dispatcher` migrado neste PR.

### Backward compatibility

**Regra de ouro**: v1 do schema **deve ser idêntica** ao shape aceito hoje
em produção. Nada de "aproveitar a migração pra apertar uma validação que
sempre quis apertar". Aperte na v2.

Mudanças de v1 → v2:

| Mudança permitida em v2             | Exemplo                                             |
| ----------------------------------- | --------------------------------------------------- |
| `.strict()` (rejeita campos extras) | `MyV1.strict()`                                     |
| Tornar opcional → obrigatório       | `external_id: z.string()`                           |
| Estreitar enum (remover valor)      | `action: z.enum(["upsert", "delete"])` (sem `sync`) |
| Forçar formato ISO em datas         | `z.string().datetime()`                             |
| Adicionar campos obrigatórios       | `idempotency_key: z.string().uuid()`                |

Tudo isso seria **breaking change** se feito na v1; em v2, o cliente opt-in
explícito via `accept-version: 2`.

---

## Específicos do projeto

### product-webhook v1 → v2

| Campo             | v1                                         | v2                                                                                    |
| ----------------- | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `action`          | `sync \| upsert \| delete \| batch_upsert` | `upsert \| delete \| batch_upsert` (sem `sync`)                                       |
| `external_id`     | opcional                                   | **obrigatório**                                                                       |
| `idempotency_key` | —                                          | **obrigatório** (UUID)                                                                |
| Strict mode       | passthrough                                | `.strict()`                                                                           |
| Validação cruzada | —                                          | `action=delete` requer `external_ids[]`; `batch_upsert` requer `products[]` não-vazio |

Sunset v1: **2026-08-31**.

#### Autenticação do produtor (n8n) — vigente desde 2026-05-24

`product-webhook` deixou de aceitar `x-webhook-secret` estático e passou a exigir assinatura por request:

- Headers obrigatórios:
  - `x-webhook-timestamp`: unix epoch em segundos
  - `x-webhook-nonce`: identificador único por request (recomendado UUID v4)
  - `x-webhook-signature`: `sha256=<hex>` (ou apenas `<hex>`)
- String a ser assinada: `<timestamp>.<nonce>.<raw_body>`
- Algoritmo: HMAC-SHA256 com o segredo compartilhado (`N8N_PRODUCT_WEBHOOK_SECRET`)
- Janela de validade: ±300s (configurável via `N8N_PRODUCT_WEBHOOK_TOLERANCE_SEC`)
- Replay protection: nonce repetido para `product-webhook` é rejeitado com `401`

Exemplo (n8n Function/Code node):

```js
const crypto = require('crypto');
const body = JSON.stringify($json);
const timestamp = Math.floor(Date.now() / 1000).toString();
const nonce = crypto.randomUUID();
const secret = $env.N8N_PRODUCT_WEBHOOK_SECRET;
const toSign = `${timestamp}.${nonce}.${body}`;
const signature = crypto.createHmac('sha256', secret).update(toSign).digest('hex');

return [
  {
    json: $json,
    headers: {
      'x-webhook-timestamp': timestamp,
      'x-webhook-nonce': nonce,
      'x-webhook-signature': `sha256=${signature}`,
    },
  },
];
```

### webhook-inbound v1 → v2

|           | v1 (atual)           | v2                                                      |
| --------- | -------------------- | ------------------------------------------------------- |
| Body      | qualquer JSON        | envelope `{event, occurred_at, data, idempotency_key?}` |
| Validação | nenhuma (lixo no DB) | `event` slug-like, `occurred_at` ISO, `data` objeto     |

Sunset v1: **2026-06-30**.

### webhook-dispatcher v1 → v2

|                       | v1                                                 | v2                                                               |
| --------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| Shape                 | flat com flags (`test_mode`, `replay_delivery_id`) | discriminated union por `mode: "dispatch" \| "replay" \| "test"` |
| Combinações inválidas | passavam pelo parsing                              | rejeitadas no schema                                             |

Sunset v1: **2026-09-30**.
