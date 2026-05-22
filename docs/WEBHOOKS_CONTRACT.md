# Webhooks & Edge Functions — Contrato de Validação

Documento de referência para o formato unificado de respostas de erro, o
versionamento de contratos (v1/v2) e a infraestrutura de testes que garante
compatibilidade retroativa entre versões.

## Endpoints sob contrato

| Endpoint              | Schema                              | Auth                                       |
|-----------------------|-------------------------------------|--------------------------------------------|
| `product-webhook`     | `ProductWebhookPayloadSchema`       | `x-webhook-secret`                         |
| `webhook-dispatcher`  | `DispatcherBodySchema`              | `x-dispatcher-secret` ou JWT supervisor    |
| `webhook-inbound`     | `InboundWebhookEnvelopeSchema`      | HMAC SHA-256 (`x-signature-256`)           |

Os schemas vivem em `supabase/functions/_shared/webhook-schemas.ts` (Deno) e
têm um mirror em `src/lib/webhook-schemas.ts` (Node) — usado pelos testes
Vitest. A paridade é garantida por
`tests/edge-functions/webhook-schemas-parity.test.ts`.

## Formato unificado de erro 422

Toda falha de validação retorna **HTTP 422 Unprocessable Entity**.

### v1 (default, retrocompatível)

```json
{
  "error": "Validation failed",
  "details": {
    "sku": ["String must contain at least 1 character(s)"],
    "price": ["Expected number, received string"]
  }
}
```

### v2 (canônico, recomendado)

```json
{
  "code": "validation_failed",
  "message": "Validation failed",
  "version": "v2",
  "fields": [
    { "path": "product.sku",   "code": "too_small",    "message": "String must contain at least 1 character(s)" },
    { "path": "product.price", "code": "invalid_type", "message": "Expected number, received string" }
  ]
}
```

Diferenças chave:

- v2 carrega `code` machine-readable estável (`validation_failed`).
- v2 expressa **paths aninhados** com dot-notation (`product.images.0`).
- v2 preserva o `code` original do Zod (`too_small`, `invalid_type`,
  `invalid_enum_value`, `invalid_string`, `custom`, ...).
- v2 nunca perde informação que estaria em v1: cada chave de `details` em v1
  corresponde ao prefixo de pelo menos um `fields[].path` em v2 (verificado
  em `webhook-schemas.contract.test.ts > contract versioning`).

## Negociação de versão

Ordem de prioridade (primeiro match vence):

1. Query string: `?api_version=v2` ou `?version=v2`
2. Header: `X-API-Version: v2` (ou `2`)
3. Accept: `application/vnd.promogifts.v2+json`
4. Default: **v1**

A versão efetiva é refletida no response header `X-API-Version`.

## Outros erros canônicos

Todos seguem o mesmo envelope (v1: `{error, details}`; v2: `{code, message, version, fields}`):

| Status | code (v2)               | Cenário                                  |
|--------|-------------------------|------------------------------------------|
| 400    | `empty_body`            | Body vazio em endpoint que exige body    |
| 400    | `invalid_json`          | Body não é JSON válido                   |
| 401    | `unauthorized`          | Auth ausente/inválida                    |
| 401    | `invalid_signature`     | HMAC inválido (webhook-inbound)          |
| 404    | `not_found`             | Recurso (delivery, webhook, endpoint)    |
| 422    | `validation_failed`     | Schema Zod falhou                        |
| 500    | `internal_error`        | Erro não capturado                       |

## Testes de contrato

Há duas camadas de cobertura:

### 1) Schema isolado (offline, rápido)

Executado em CI via `npm run test`. Arquivos em `tests/edge-functions/`:

- `validation-errors.test.ts` — 19 testes da infra de respostas (negociação,
  builders v1/v2, invariantes).
- `webhook-schemas.contract.test.ts` — 47 testes dos schemas (happy path,
  campos ausentes, tipos incorretos, valores vazios, regras cross-field,
  limites de tamanho, propagação de erros aninhados, e a invariante
  v1 ⊂ v2 que sustenta a deprecação segura de v1).
- `webhook-schemas-parity.test.ts` — 3 testes que garantem que o mirror Node
  é byte-idêntico ao canônico Deno (exceto pelo import path).

```bash
npm run test -- tests/edge-functions/
# → 101 testes, todos passam em ~3s
```

### 2) End-to-end HTTP (online, contra deploy)

`scripts/contract-testing.mjs` (`npm run test:contract`) faz chamadas reais
contra a Edge Function deployada. Cobre o ciclo completo: cabeçalhos de
auth, parsing do body, schema, e shape da resposta — em ambas as versões.

```bash
SUPABASE_SERVICE_ROLE_KEY=... npm run test:contract
```

## Como adicionar contrato a um endpoint novo

1. Defina o schema em `supabase/functions/_shared/webhook-schemas.ts` e
   espelhe em `src/lib/webhook-schemas.ts` (a paridade roda em CI).

2. Na Edge Function, troque o boilerplate manual por:

   ```ts
   import { buildErrorResponse, buildValidationErrorResponse }
     from "../_shared/validation-errors.ts";
   import { MeuSchema } from "../_shared/webhook-schemas.ts";

   // ... dentro do handler:
   const parsed = MeuSchema.safeParse(rawBody);
   if (!parsed.success) {
     return buildValidationErrorResponse(parsed.error, req, corsHeaders);
   }
   ```

   Ou, mais conciso, use o helper existente:

   ```ts
   import { parseBodyWithSchema } from "../_shared/zod-validate.ts";

   const result = await parseBodyWithSchema(req, MeuSchema, corsHeaders);
   if ("error" in result) return result.error;
   const payload = result.data;
   ```

3. Adicione cenários ao `webhook-schemas.contract.test.ts` cobrindo no
   mínimo: happy path, cada campo obrigatório ausente, cada tipo errado,
   cada string obrigatória vazia, cada regra cross-field.

4. Adicione cenários ao `scripts/contract-testing.mjs` validando o
   round-trip HTTP em v1 e v2.

## Deprecação de v1

Quando v1 for descontinuado:

1. Anuncie via `Deprecation: true` e `Sunset: <date>` headers nas respostas
   v1 (a infra atual já suporta — basta estender `buildValidationError`).
2. Mantenha as duas versões em paralelo por **≥90 dias** após o anúncio.
3. O teste `contract versioning: v1 ↔ v2 backwards compatibility` garante
   que nenhuma informação semântica é perdida durante a transição.
4. Após o sunset, remova `buildValidationErrorV1` e o branch de detecção
   v1 em `detectContractVersion` — os testes de paridade falharão
   automaticamente até a remoção ser propagada para ambos os mirrors.
