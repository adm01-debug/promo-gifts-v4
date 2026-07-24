# Contract validation package

Pacote canônico de validação de payload e versionamento de Edge Functions
do Promo Gifts V4. Substitui o padrão antigo (cada função inventando seu
próprio formato de erro e usando HTTP 400 para tudo).

## Por que existe

Antes deste pacote (auditoria 2026-05-21):

- 82 Edge Functions, **49** recebem payload externo, apenas **13** validavam com Zod.
- 3 formatos de erro diferentes conviviam: `{error}`, `{error, details}`, `{error: "internal_error"}`.
- HTTP 400 era retornado tanto para JSON quebrado quanto para falha semântica do schema.
- Nenhum endpoint tinha versionamento — qualquer mudança quebrava clientes em produção.

Este pacote resolve isso com **uma porta de entrada única**: `parseContract`.

## Estrutura

```
supabase/functions/_shared/contracts/
├── index.ts          # barrel export
├── errors.ts         # builders 400 / 422 / 406 com formato {code, message, fields[]}
├── versioning.ts     # negociação via accept-version | ?v= | default
├── parse.ts          # parseContract(req, schemas) — orquestrador
└── schemas/          # schemas por endpoint, sempre múltiplas versões
    ├── product-webhook.ts
    ├── webhook-inbound.ts
    └── webhook-dispatcher.ts
```

## Uso rápido

```ts
import { parseContract } from "../_shared/contracts/index.ts";
import { ProductWebhookSchemas } from "../_shared/contracts/schemas/product-webhook.ts";

const result = await parseContract(req, ProductWebhookSchemas, { corsHeaders });
if (!result.ok) return result.response; // 400 / 422 / 406 já formatado

const { version, data, responseHeaders } = result;
// data tem o tipo correspondente à versão resolvida
// responseHeaders inclui x-contract-version + (Deprecation, Sunset) se aplicável
```

## Formato de erro canônico

Toda resposta de falha de validação tem este shape:

```json
{
  "code": "validation_failed",
  "message": "One or more fields are invalid.",
  "fields": [
    { "path": "product.price", "message": "Expected number, got string", "code": "invalid_type" },
    { "path": "product.images[0]", "message": "Invalid url", "code": "invalid_string" }
  ],
  "version": "1",
  "request_id": "..."  // opcional
}
```

Códigos possíveis:

| code                          | HTTP | quando                              |
| ----------------------------- | ---- | ----------------------------------- |
| `missing_body`                | 400  | body vazio                          |
| `invalid_json`                | 400  | body não é JSON válido              |
| `validation_failed`           | 422  | JSON OK mas campos inválidos        |
| `unsupported_version`         | 406  | `accept-version` fora de `supported`|

Path notation em `fields[].path`:

- Objetos aninhados: `product.sku`, `endpoint.config.timeout`
- Arrays: `images[0]`, `products[3].sku`
- Raiz: `$`

## Versionamento

Três jeitos do cliente pedir uma versão (em ordem de prioridade):

1. Header **`accept-version: 2`** (preferido — RFC-style)
2. Query **`?v=2`**
3. Default da função (declarado no schema)

Versões em depreciação continuam funcionando, mas a resposta carrega
(por RFC 8594):

```
Deprecation: true
Sunset: Mon, 31 Aug 2026 00:00:00 GMT
Link: <https://docs/...>; rel="deprecation"
```

Versões inexistentes retornam **406** com `code=unsupported_version` e a
lista de versões aceitas no `message`.

## Endpoints migrados e sunsets

Esta é a matriz canônica dos contratos ativos. A data de `Sunset` abaixo é a
mesma declarada nos schemas de `_shared/contracts/schemas/`.

| Lote | Endpoint | Default | Versão deprecated | Sunset |
| ---- | -------- | ------- | ----------------- | ------ |
| Base | `product-webhook` | v1 | v1 | 2026-08-31 |
| Base | `webhook-inbound` | v2 | v1 | 2026-06-30 |
| Base | `webhook-dispatcher` | v1 | v1 | 2026-09-30 |
| P0 | `send-transactional-email` | v1 | v1 | 2026-10-31 |
| P0 | `kit-ai-builder` | v1 | v1 | 2026-10-31 |
| P0 | `bi-copilot` | v1 | v1 | 2026-10-31 |
| P0 | `market-intelligence-insights` | v1 | v1 | 2026-10-31 |
| P0 | `step-up-verify` | v1 | v1 | 2026-10-31 |
| P1 | `ownership-audit` | v1 | v1 | 2026-11-30 |
| P1 | `ownership-repair` | v1 | v1 | 2026-11-30 |
| P1 | `simulation-orchestrator` | v1 | v1 | 2026-11-30 |
| P1 | `sync-external-db` | v1 | v1 | 2026-11-30 |
| P1 | `trends-insights` | v1 | v1 | 2026-11-30 |
| P2 | `force-global-logout` | v1 | v1 | 2026-12-31 |
| P2 | `e2e-cleanup` | v1 | v1 | 2026-12-31 |
| P2 | `block-ip-temporarily` | v1 | v1 | 2026-12-31 |

Notas P1 v2:

- `ownership-repair`, `simulation-orchestrator` e `sync-external-db` exigem
  `idempotency_key` por executarem operacoes com side-effect.
- `ownership-audit` permanece sem `idempotency_key` porque e leitura/auditoria.
- `trends-insights` permanece sem `idempotency_key` porque e analise/leitura sem
  mutacao de dados; v2 strict aceita apenas `days` para limitar o payload do
  fluxo de IA.

## Adicionando um novo schema

```ts
// supabase/functions/_shared/contracts/schemas/<endpoint>.ts
import { z } from "https://esm.sh/zod@3.23.8";

export const MyEndpointV1 = z.object({ /* ... */ });
export const MyEndpointV2 = z.object({ /* ... */ }).strict();

export const MyEndpointSchemas = {
  name: "my-endpoint",
  versions: {
    "1": MyEndpointV1,
    "2": MyEndpointV2,
  },
  defaultVersion: "1" as const,
  deprecated: [
    { version: "1", sunset: "2026-12-31", migrationUrl: "https://..." },
  ],
};
```

Boas práticas para v2:

- Use `.strict()` — rejeita campos desconhecidos.
- Adicione `idempotency_key` quando o endpoint causa side-effects.
- Datas como `z.string().datetime()` (ISO 8601 obrigatório).
- Discriminated unions (`z.discriminatedUnion`) para verbos múltiplos no mesmo endpoint.

## Testando

Testes vivem em `tests/contracts/` (vitest). Resolvedor de URL → npm está
configurado no `vitest.config.ts`:

```ts
{ find: /^https:\/\/esm\.sh\/zod@.*$/, replacement: 'zod' }
```

Cada novo schema **deve** vir com testes para:

- Payload válido em cada versão suportada
- Body vazio → `400 missing_body`
- JSON quebrado → `400 invalid_json`
- Campo obrigatório ausente → `422 validation_failed`
- Campo com tipo errado → `422 validation_failed`
- Versão inválida → `406 unsupported_version`
- Versão deprecated → headers `Deprecation` + `Sunset`

## Smoke contract test (HTTP real)

```bash
# Roda contra Edge Functions reais (default localhost)
SUPABASE_ANON_KEY=... npm run test:contract

# Contra produção em modo seguro (apenas leituras)
SUPABASE_URL=https://<proj>.supabase.co \
SUPABASE_ANON_KEY=... \
  npm run test:contract
```
