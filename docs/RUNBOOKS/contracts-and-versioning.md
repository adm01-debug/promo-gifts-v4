# Contratos de Edge Functions — Schemas, Erros 422, Versionamento v1/v2

Este runbook documenta como o projeto trata contratos de I/O das Edge Functions:
onde os schemas Zod vivem, como o erro 422 é padronizado, e como evoluir um
contrato (criar v2, depreciar v1) sem quebrar consumidores existentes.

## 1. Onde vivem os contratos

```
supabase/functions/_shared/contracts/
├── error-response.ts       # shape único + helpers de Response
├── versioning.ts           # resolveContractVersion + Deprecation/Sunset
└── <endpoint>.contracts.ts # registry { v1: { schema, status, examples } }
```

Cada `<endpoint>.contracts.ts` é a **fonte única de verdade**. Ele é consumido
por:

- O handler (`supabase/functions/<endpoint>/index.ts`) via `parseBodyWithSchema`
  ou `parseRequestWithContract` (de `_shared/zod-validate.ts`).
- Os testes Vitest em `tests/contract/edge-functions/all-contracts.test.ts`.
- Os testes Deno colocados (apenas para os 3 webhooks externos).
- O runner live `scripts/contract-testing.mjs`.

Mudar o schema em um único lugar atualiza todas essas pontas — não duplique.

## 2. Shape único de erro

Toda resposta de erro de contrato segue o shape:

```ts
{
  code: 'VALIDATION_FAILED' | 'INVALID_JSON' | 'MISSING_BODY' | 'UNSUPPORTED_VERSION',
  message: string,                                  // humano, em PT-BR
  fields: Array<{ path: string; code: string; message: string }>
}
```

Política de status code:

| Cenário                                    | Status | code                  |
| ------------------------------------------ | ------ | --------------------- |
| Body válido por JSON mas falha o schema    | **422** | `VALIDATION_FAILED`   |
| Body sintaticamente inválido (não é JSON)  | 400    | `INVALID_JSON`        |
| Body ausente ou string vazia               | 400    | `MISSING_BODY`        |
| `X-Contract-Version` desconhecido          | 400    | `UNSUPPORTED_VERSION` |

O `path` em `fields[]` é dot-notation (`products.0.sku`, não `products[0].sku`).
Campos obrigatórios ausentes têm `code: "required"` (não `invalid_type`).

## 3. Versionamento

Resolução de versão é centralizada em `_shared/contracts/versioning.ts`:

1. Header `X-Contract-Version: vN` (case-insensitive). Preferido.
2. Query string `?v=vN` (fallback, útil para webhooks de parceiros sem
   controle de header).
3. Default = primeira chave do registry (convencionalmente `v1`).

A resposta sempre ecoa `X-Contract-Version` com a versão resolvida. Quando
a versão está marcada como `status: 'deprecated'`, a resposta também recebe:

- `Deprecation: true`
- `Sunset: 2026-08-22` (ISO date)

## 4. Como criar uma v2

1. Em `_shared/contracts/<endpoint>.contracts.ts`, defina o novo schema:
   ```ts
   const PayloadV2 = PayloadV1.extend({ currency: z.string() });
   ```
2. Adicione ao registry:
   ```ts
   export const contracts = {
     v1: { schema: PayloadV1, status: 'deprecated', sunset: '2026-08-22', examples: { ... } },
     v2: { schema: PayloadV2, status: 'stable', examples: { ... } },
   };
   ```
3. No handler, use `parseRequestWithContract(req, contracts, corsHeaders)`.
   Faça branching pelo `result.version` para mapear v2 → modelo interno.
4. Atualize `examples.valid[]` e `examples.invalid[]` da v2.
5. Rode os testes:
   ```
   npm test -- tests/contract/edge-functions
   deno test --no-check --allow-env --allow-net=none \
     supabase/functions/<endpoint>/contract_test.ts
   ```
6. **Não remova** v1 imediatamente — só após o Sunset E confirmar que nenhum
   consumidor real ainda envia payloads v1 (analytics no Supabase function logs:
   filtrar por `X-Contract-Version: v1` ou pelo handler logando a versão).

## 5. Como remover uma versão depreciada

Política: minimum 60 dias de aviso público a contar do Sunset. Antes de
remover:

1. Cheque logs por receitas v1 nos últimos 30 dias (zero esperado).
2. Avise consumidores conhecidos via canal apropriado (Slack n8n, etc.).
3. Remova a entrada `v1` do registry — testes do `versioning.test.ts` farão
   com que `X-Contract-Version: v1` retorne 400 `UNSUPPORTED_VERSION`
   automaticamente. Adicione cenário negativo no teste para travar regressão.

## 6. Inventory gate

`tests/contract/edge-functions/inventory.test.ts` falha o CI se uma Edge
Function for adicionada em `supabase/functions/<name>/` sem:

- arquivo `_shared/contracts/<name>.contracts.ts`, **ou**
- entrada em `tests/contract/_allowlist/no-contract.json`.

A allowlist é dívida explícita: cada item lá precisa ser migrado para contrato
no longo prazo. PR que adiciona à allowlist deve documentar a razão na
descrição.

## 7. Comandos úteis

```bash
# Vitest in-process (rápido, sem env)
npm test -- tests/contract/edge-functions

# Deno colocados para os 3 webhooks externos
deno test --no-check --allow-env --allow-net=none \
  supabase/functions/product-webhook/contract_test.ts \
  supabase/functions/webhook-inbound/contract_test.ts \
  supabase/functions/webhook-dispatcher/contract_test.ts

# Live contra staging (requer secrets)
SUPABASE_URL=https://STAGING.supabase.co \
CONTRACT_TEST_TOKEN=<service_role> \
npm run test:contract
```
