# Patch manual: `external-db-bridge/index.ts` — kill-switch integration

**Contexto:** análise forense do colapso 2026-05-24 → ver [`RELATORIO_COLAPSO_2026-05-24.md`](./RELATORIO_COLAPSO_2026-05-24.md).

O helper `supabase/functions/_shared/kill_switch.ts` já está em `main` (commit `7101902`). Falta apenas integrá-lo na edge function `external-db-bridge` para que o switch `edge_external_db_bridge` (já `false` em `public.system_kill_switches`) seja efetivo.

## Por que esse patch não foi feito via PR automatizado

O arquivo `supabase/functions/external-db-bridge/index.ts` tem 88KB / 1985 linhas — acima do limite prático de upload das ferramentas MCP usadas na análise. As **duas mudanças cirúrgicas** abaixo precisam ser aplicadas manualmente.

## Mudança 1 — Adicionar import (linha ~36)

**Localizar:**

```typescript
import { constantTimeEqual } from "../_shared/dispatcher-auth.ts";
```

**Adicionar logo abaixo:**

```typescript
import { assertSwitchEnabled } from "../_shared/kill_switch.ts";
```

## Mudança 2 — Inserir checagem do kill-switch (linha ~451)

**Localizar este bloco** dentro do `Deno.serve((req) => { ... })`:

```typescript
    } catch (e) {
      console.error(`[external-db-bridge] CORS init failed: ${(e as Error).message}`);
    }

    const requestStartTime = performance.now();
```

**Inserir as linhas marcadas com `+`** entre o `}` do `catch` e a declaração `const requestStartTime`:

```typescript
    } catch (e) {
      console.error(`[external-db-bridge] CORS init failed: ${(e as Error).message}`);
    }

+   // ============================================
+   // KILL-SWITCH (Caminho B): cortar tráfego legado ANTES de qualquer trabalho.
+   // Ver docs/RELATORIO_COLAPSO_2026-05-24.md.
+   // Quando o switch `edge_external_db_bridge` está OFF em
+   // public.system_kill_switches, retorna 410 Gone imediatamente —
+   // sem ler credenciais, sem abrir DB I/O.
+   // ============================================
+   try {
+     const goneResponse = await assertSwitchEnabled("edge_external_db_bridge", req, corsHeaders);
+     if (goneResponse) {
+       console.log(`[external-db-bridge] [req_id=${requestId}] kill-switch ACTIVE — returning 410`);
+       return goneResponse;
+     }
+   } catch (e) {
+     // Fail-open: erro na checagem do switch NÃO bloqueia tráfego legítimo.
+     console.warn(`[external-db-bridge] kill-switch check error: ${(e as Error).message}`);
+   }

    const requestStartTime = performance.now();
```

## Como ativar / desativar o kill-switch

Sem precisar redeploy. Edita só a tabela:

```sql
-- Desligar a função (já está assim agora):
UPDATE public.system_kill_switches
SET enabled = false,
    legacy_message = 'external-db-bridge foi descontinuada. Use REST nativo /rest/v1/.'
WHERE switch_name = 'edge_external_db_bridge';

-- Reativar (em caso de emergência):
UPDATE public.system_kill_switches
SET enabled = true
WHERE switch_name = 'edge_external_db_bridge';
```

Cache em memória dentro da edge function é de **60s**, então mudanças propagam em até 1 minuto.

## Validação após aplicar

Depois de fazer deploy:

```bash
curl -X POST https://doufsxqlfjyuvxuezpln.supabase.co/functions/v1/external-db-bridge \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -d '{"operation":"select","table":"products","limit":1}'
```

Deve retornar **HTTP 410 Gone** com payload:

```json
{
  "error": "Gone",
  "switch": "edge_external_db_bridge",
  "message": "external-db-bridge foi descontinuada. Use REST nativo /rest/v1/.",
  "migration_hint": "Use chamadas REST nativas em /rest/v1/ ou a função substituta correspondente."
}
```

Nos logs da edge function deve aparecer:

```
[external-db-bridge] [req_id=...] kill-switch ACTIVE — returning 410
```

## Impacto esperado nos logs do Postgres

- Queries de external-db-bridge no `pg_stat_activity` → **zeram**
- `idle in transaction` count de PostgREST → **cai gradualmente** (TTL 10min)
- Logs de cron de keep-alive (`external-db-bridge-keep-warm` se existir) → continuam, mas curtos
- Front-end legado que dependia da função → recebe 410 e cliente é responsabilidade de migrar

## Identificar callers (quem ainda chama)

Search-and-replace no front-end:

```bash
git grep -r "external-db-bridge" src/
git grep -r "external-db-bridge" client/
```

Todos os call sites devem migrar para chamadas REST nativas:

```typescript
// ANTES (legacy):
supabase.functions.invoke("external-db-bridge", {
  body: { operation: "select", table: "products", limit: 50 }
});

// DEPOIS (REST nativo):
supabase.from("products").select("*").limit(50);
```
