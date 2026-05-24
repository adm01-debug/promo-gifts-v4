# Apêndice D — Migração de dados (não só schema)

> Este apêndice é **parte do** [Manual de Migração Lovable → Supabase Oficial](./MANUAL-MIGRACAO-LOVABLE-PARA-SUPABASE-OFICIAL.md).
> Leia o manual principal antes deste apêndice. O Apêndice D **assume** que você já alinhou os schemas (Fases 1-3) e está pronto para mover os dados.

---

## 📑 Índice deste apêndice

1. [Quando migrar dados (e quando NÃO migrar)](#d1-quando)
2. [Pré-requisitos críticos](#d2-prerrequisitos)
3. [Decidir a estratégia (3 caminhos)](#d3-estrategia)
4. [Mapa do fluxo BPM](#d4-mapa)
5. [Tarefa 1 — Inventário de volumes](#d5-inventario)
6. [Tarefa 2 — Ordem topológica de FKs](#d6-ordem)
7. [Tarefa 3 — Tabela de checkpoint](#d7-checkpoint)
8. [Tarefa 4 — Dump por chunks (3 padrões)](#d8-dump)
9. [Tarefa 5 — Restore com `ON CONFLICT`](#d9-restore)
10. [Tarefa 6 — Validação pós-migração](#d10-validacao)
11. [Troubleshooting específico de dados](#d11-troubleshooting)
12. [Templates prontos](#d12-templates)
13. [Checklist final](#d13-checklist)

---

## D.1 — Quando migrar dados (e quando NÃO migrar) {#d1-quando}

**Princípio**: migrar dados é diferente de migrar schema. Schema você sempre quer alinhar. Dados, nem sempre.

### Decisão por categoria

| Categoria da tabela | Migrar dados? | Por quê |
|---|:---:|---|
| **Catálogo SSOT** (produtos, clientes, técnicas) | ✅ Sim | App futuro vai ler do Oficial; precisa estar lá. |
| **Transações de negócio** (orders, quotes, kits) | ✅ Sim | Histórico precisa sobreviver |
| **Tabela órfã migrada na Fase 2** | ✅ Sim | Você acabou de criar a tabela vazia; precisa popular |
| **`cache_denormalizado` (allowlist)** | ❌ Não | Cache se regenera por design — não tem sentido copiar |
| **`infra_lovable` (allowlist)** | ❌ Não | Runtime exclusivo do Lovable; não serve no Oficial |
| **`particao_log` (allowlist)** | ❌ Não | Particionamento é específico de um lado |
| **`infra_independente` (allowlist)** | ❌ Não | Mesmo nome, propósitos diferentes |
| **`_backup_*`** | ❌ Não | Sufixo já indica que é descartável |
| **`logs` / `audit_*` antigos** | 🟡 Parcial | Só janela recente (ex: últimos 90 dias) por custo |
| **`*_old` / `*_legacy` (Fase 1.1)** | ❌ Não | Você vai dropar na Fase 1.1 |

### Pergunta de ouro

**Se essa tabela for repopulada a partir do zero amanhã, isso quebra alguma coisa do negócio?**

- **Sim** → migra
- **Não** → não migra (deixa o cache/runtime regenerar)

### Outro princípio: dados sensíveis e LGPD

- Antes de migrar tabelas com PII (clientes, usuários, logs de acesso, dados de pagamento), **confirme com o sponsor** se a LGPD/GDPR permite a movimentação para o Supabase Oficial.
- Se o Oficial for em outra região (US vs BR), **isso pode ser violação**. Pare e investigue.

---

## D.2 — Pré-requisitos críticos {#d2-prerrequisitos}

**Não comece a migração de dados se algum desses não estiver verde:**

| Pré-requisito | Como validar |
|---|---|
| Schemas 100% alinhados | Gate CI: `has_drift = false` na última execução |
| FKs reconciliadas | Todas as tabelas-pai existem no Oficial antes das tabelas-filha |
| Constraints unique compatíveis | Mesmas colunas com `UNIQUE` nos dois lados |
| Tipos exatamente iguais | `text` no Lovable vs `uuid` no Oficial **quebra o INSERT** |
| RLS configurada | Senão você vai inserir como `service_role` mas o app não lê depois |
| Triggers `BEFORE INSERT` mapeadas | Algumas geram IDs, hashes — você precisa saber pra desabilitar se for dump fiel |
| Auth users sincronizados (se aplicável) | FK para `auth.users.id` quebra se o user não existir nos dois lados |

### O caso especial de `auth.users`

Se suas tabelas têm FK para `auth.users(id)`, você precisa **primeiro** sincronizar os usuários. Tem três caminhos:

1. **Recriar via `auth.admin.createUser`** no Oficial usando o ID do Lovable. Mantém UUIDs estáveis.
2. **Manter mapeamento** `lovable_user_id → oficial_user_id` numa tabela auxiliar e rewrite das FKs no INSERT.
3. **Reusar Auth do Lovable** apontando o JWT do Oficial para o mesmo emissor (raramente possível).

Esse manual cobre o caminho 1 como padrão. Caminho 2 está em Troubleshooting.

---

## D.3 — Decidir a estratégia (3 caminhos) {#d3-estrategia}

| Estratégia | Quando usar | Prós | Contras |
|---|---|---|---|
| **A — Pull via RPC HTTP** (`net.http_post` no Oficial) | Tabelas pequenas/médias (até ~10k rows totais) | Tudo dentro do MCP, automatizável | HTTP timeout, payload >1MB falha, depende do Lovable expor RPC |
| **B — Pull via `lovable_dump_data`** (MCP nativo, chunks de 1000) | Volume médio (10k–500k rows) | Granular, sem timeout HTTP, retomável | Lento — uma chamada MCP por chunk |
| **C — Export pg_dump local + restore** | Volume grande (>500k rows) ou prazo curto | Fast, transacional | Fora do escopo MCP, precisa acesso direto ao DB |

**Recomendação default**: **Estratégia B** (Lovable MCP `dump_data` + restore via `apply_migration` no Oficial). Funciona para 95% dos casos e é 100% Claude-friendly.

Se cair na C, **pare** e devolva pro sponsor humano — ele provavelmente vai querer fazer com `pg_dump` direto.

---

## D.4 — Mapa do fluxo BPM {#d4-mapa}

```
[INÍCIO] Schemas alinhados ✅
   │
   ▼
[Tarefa 1] Inventário de volumes
   │  count(*) por tabela no Lovable
   │  Marca quais migrar / quais skip
   ▼
[Tarefa 2] Ordem topológica
   │  Resolver FKs (pais antes de filhos)
   │  Detectar ciclos (deferred FKs)
   ▼
[Tarefa 3] Tabela de checkpoint
   │  data_migration_log: progresso retomável
   ▼
[Tarefa 4] Dump por chunks
   │  Por tabela, em ordem topológica:
   │  ├─ A) RPC HTTP (pequenas)
   │  ├─ B) lovable_dump_data (médias)  ← DEFAULT
   │  └─ C) pg_dump local (grandes, fora MCP)
   ▼
[Tarefa 5] Restore com ON CONFLICT
   │  apply_migration com INSERT ... ON CONFLICT
   │  Update checkpoint
   ▼
[Tarefa 6] Validação
   │  count() match, sample hash match, FKs íntegras
   ▼
[FIM] Tabelas com dados sincronizados
```

---

## D.5 — Tarefa 1: Inventário de volumes {#d5-inventario}

**Objetivo**: descobrir quanto vai mover, decidir estratégia A/B/C por tabela, e estimar tempo.

### Query no Lovable (volume de cada tabela)

```sql
-- No Lovable via lovable_db_query
WITH t AS (
  SELECT table_schema, table_name
    FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_type   = 'BASE TABLE'
     AND table_name NOT LIKE '\_backup\_%' ESCAPE '\'
)
SELECT
  t.table_name,
  (xpath('/row/c/text()', xml_count))[1]::text::bigint AS row_count,
  pg_size_pretty(pg_total_relation_size(format('public.%I', t.table_name))) AS tamanho
FROM t,
LATERAL (
  SELECT query_to_xml(format('SELECT count(*) AS c FROM public.%I', t.table_name),
                      false, true, '') AS xml_count
) x
ORDER BY row_count DESC NULLS LAST
LIMIT 100;
```

### Saída esperada

| `table_name` | `row_count` | `tamanho` | Estratégia | Migrar? |
|---|---:|---:|---|:---:|
| `products` | 4.812 | 9.5 MB | — | ❌ allowlist (cache) |
| `mockup_jobs` | 1.250 | 2.1 MB | **B** | ✅ |
| `mockup_templates` | 78 | 380 kB | **A** | ✅ |
| `quote_items` | 18.430 | 22 MB | **B** | ✅ |
| `simulation_logs` | 90.000 | 180 MB | — | ❌ allowlist (infra) |
| `order_items` | 0 | 16 kB | **A** | ✅ (vazia, copia struct) |

**Regras práticas**:
- `row_count < 1000` → Estratégia **A** (1 RPC call resolve)
- `1k ≤ row_count < 500k` → Estratégia **B** (`dump_data` em chunks)
- `row_count ≥ 500k` → **C** (devolve pro humano)

### Documente o inventário

Salve isso como `docs/redeploy/FASE-5-DATA-MIGRATION-INVENTORY.md`:

```markdown
# Fase 5 — Inventário de migração de dados

## Total a migrar
- Tabelas elegíveis: <n>
- Linhas totais: <soma>
- Estimativa tempo (300 rows/s via MCP): <minutos>

## Por estratégia
- A (RPC HTTP, <1k rows): <lista>
- B (lovable_dump_data, 1k-500k rows): <lista>
- C (pg_dump, ≥500k rows): <lista> ← REQUER HUMANO

## Não-migráveis (allowlist + outras)
- <lista com motivo>
```

---

## D.6 — Tarefa 2: Ordem topológica de FKs {#d6-ordem}

**Princípio**: pais antes de filhos. Se você insere `order_items` antes de `orders`, vai violar a FK.

### Query que retorna ordem topológica

```sql
-- No Oficial. Retorna lista de tabelas em ordem segura para INSERT.
WITH RECURSIVE fk_deps AS (
  SELECT
    c.conrelid::regclass::text AS table_name,
    c.confrelid::regclass::text AS parent_table
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE c.contype = 'f'
    AND n.nspname = 'public'
    AND c.conrelid::regclass::text NOT LIKE 'public.\_backup\_%' ESCAPE '\'
),
all_tables AS (
  SELECT format('public.%I', table_name)::text AS table_name
    FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_type   = 'BASE TABLE'
),
no_deps AS (
  SELECT table_name, 0 AS depth
    FROM all_tables
   WHERE table_name NOT IN (SELECT table_name FROM fk_deps WHERE table_name <> parent_table)
  UNION ALL
  SELECT fk.table_name, nd.depth + 1
    FROM fk_deps fk
    JOIN no_deps nd ON fk.parent_table = nd.table_name
   WHERE fk.table_name <> fk.parent_table
)
SELECT table_name, MAX(depth) AS load_order
  FROM no_deps
 GROUP BY table_name
 ORDER BY load_order, table_name;
```

### Tabelas com ciclo (auto-referência ou ciclo entre tabelas)

Se você ver tabelas duplicadas ou que não aparecem na lista acima, é ciclo. Soluções:

1. **Self-FK** (`parent_id` na mesma tabela): insira com `parent_id = NULL` primeiro, depois faça UPDATE.
2. **Ciclo A→B→A**: declare a FK como `DEFERRABLE INITIALLY DEFERRED`, insira tudo numa transação, faz COMMIT.

### Exemplo prático

```
load_order | table_name
-----------|-----------------------
         0 | public.users           ← raiz
         0 | public.products
         0 | public.techniques
         1 | public.client_profiles ← depende de users
         1 | public.orders          ← depende de users
         2 | public.order_items     ← depende de orders + products
         2 | public.quote_items     ← depende de quotes + products
         3 | public.mockup_jobs     ← depende de order_items
```

Migre em ordem crescente de `load_order`. Empate na ordem? Pode ser paralelo.

---

## D.7 — Tarefa 3: Tabela de checkpoint {#d7-checkpoint}

**Princípio**: migração de dados PODE quebrar no meio. Sem checkpoint, você não sabe de onde retomar.

### Criar tabela de progresso

```sql
-- No Oficial via apply_migration
CREATE TABLE IF NOT EXISTS public.data_migration_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      text NOT NULL,
  strategy        text NOT NULL CHECK (strategy IN ('A_rpc', 'B_dump', 'C_pgdump')),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','done','failed','skipped')),
  rows_source     bigint,
  rows_inserted   bigint DEFAULT 0,
  rows_conflict   bigint DEFAULT 0,
  last_offset     bigint DEFAULT 0,        -- onde retomar (B)
  last_keyset_val text,                    -- onde retomar (keyset pagination)
  started_at      timestamptz,
  finished_at     timestamptz,
  error_message   text,
  notes           text,
  UNIQUE (table_name, strategy)
);

ALTER TABLE public.data_migration_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage data migration log"
  ON public.data_migration_log
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles
                  WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles
                       WHERE user_id = auth.uid() AND role = 'admin'));

COMMENT ON TABLE public.data_migration_log IS
  'Checkpoint retomável da migração de dados Lovable → Oficial';
```

### Helper para registrar progresso

```sql
CREATE OR REPLACE FUNCTION public.fn_migration_checkpoint(
  p_table        text,
  p_strategy     text,
  p_status       text,
  p_offset       bigint DEFAULT NULL,
  p_inserted     bigint DEFAULT NULL,
  p_conflict     bigint DEFAULT NULL,
  p_error        text   DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.data_migration_log (table_name, strategy, status, last_offset,
                                          rows_inserted, rows_conflict, error_message,
                                          started_at, finished_at)
  VALUES (
    p_table, p_strategy, p_status,
    COALESCE(p_offset, 0),
    COALESCE(p_inserted, 0),
    COALESCE(p_conflict, 0),
    p_error,
    CASE WHEN p_status = 'running' THEN now() ELSE NULL END,
    CASE WHEN p_status IN ('done','failed','skipped') THEN now() ELSE NULL END
  )
  ON CONFLICT (table_name, strategy) DO UPDATE
  SET status        = EXCLUDED.status,
      last_offset   = GREATEST(public.data_migration_log.last_offset, COALESCE(EXCLUDED.last_offset, 0)),
      rows_inserted = public.data_migration_log.rows_inserted + COALESCE(EXCLUDED.rows_inserted, 0),
      rows_conflict = public.data_migration_log.rows_conflict + COALESCE(EXCLUDED.rows_conflict, 0),
      error_message = EXCLUDED.error_message,
      finished_at   = CASE WHEN EXCLUDED.status IN ('done','failed','skipped')
                           THEN now() ELSE public.data_migration_log.finished_at END;
END;
$$;
```

### Como retomar uma migração interrompida

```sql
-- Quais ficaram pela metade?
SELECT table_name, strategy, status, last_offset, rows_inserted, error_message
  FROM public.data_migration_log
 WHERE status IN ('running','failed');

-- Para cada um, comece o próximo chunk a partir de last_offset
```

---

## D.8 — Tarefa 4: Dump por chunks (3 padrões) {#d8-dump}

### Padrão A — Pull via RPC HTTP (tabelas pequenas, <1k rows)

#### A.1 — Criar RPC no Lovable que retorna a tabela inteira

```sql
-- No Lovable via lovable_db_query (confirm=true)
CREATE OR REPLACE FUNCTION public.dump_table_<nome>()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
    FROM public.<nome> t;
$$;

GRANT EXECUTE ON FUNCTION public.dump_table_<nome>() TO anon, authenticated;
```

⚠️ **Cuidado**: payload >1MB falha no `net.http_post`. Se a tabela tem >1k rows ou colunas grandes (texto, jsonb), use **Padrão B**.

#### A.2 — Pull no Oficial

```sql
-- No Oficial
SELECT public.fn_migration_checkpoint('<nome>', 'A_rpc', 'running');

WITH req AS (
  SELECT net.http_post(
    url := (SELECT value #>> '{}' FROM public.system_settings WHERE key='lovable_url')
           || '/rest/v1/rpc/dump_table_<nome>',
    headers := jsonb_build_object(
      'apikey',        (SELECT value #>> '{}' FROM public.system_settings WHERE key='lovable_anon_key'),
      'Authorization', 'Bearer ' || (SELECT value #>> '{}' FROM public.system_settings WHERE key='lovable_anon_key'),
      'Content-Type',  'application/json'
    ),
    body := '{}'::jsonb
  ) AS req_id
),
_wait AS (SELECT pg_sleep(10)),
resp AS (
  SELECT content::jsonb AS rows
    FROM net._http_response, req
   WHERE id = req.req_id
)
SELECT jsonb_array_length(rows) AS qtd FROM resp;
-- Salve o JSON, prossiga para o restore (Tarefa 5).
```

### Padrão B — `lovable_dump_data` em chunks (DEFAULT)

#### B.1 — Loop em chunks de 1000

O `lovable_dump_data` aceita `offset` e `limit` (max 1000). Você (Claude) faz isso em loop:

```python
# Pseudocódigo do que você executa
offset = read_checkpoint("<nome>")  # 0 na primeira execução
total_inserted = 0

while True:
    chunk = lovable_dump_data(
        project_id="<lovable-id>",
        table="<nome>",
        limit=1000,
        offset=offset
    )
    if not chunk or len(chunk["rows"]) == 0:
        break

    # Tarefa 5: gerar INSERT bulk com ON CONFLICT
    inserted = apply_migration_with_insert(chunk["rows"])
    total_inserted += inserted

    # Checkpoint
    update_checkpoint("<nome>", offset=offset + len(chunk["rows"]),
                      rows_inserted=inserted)

    offset += len(chunk["rows"])

    if len(chunk["rows"]) < 1000:
        break  # última página

mark_done("<nome>", total_inserted)
```

#### B.2 — Keyset pagination (mais seguro que OFFSET para tabelas grandes)

OFFSET é ruim para tabelas com >100k rows (cada chunk fica progressivamente mais lento). Use keyset:

```sql
-- No Lovable, capture a PK ordenada
SELECT * FROM public.<nome>
 WHERE id > $1                  -- $1 = last_keyset_val do checkpoint
 ORDER BY id
 LIMIT 1000;
```

Salva o último `id` no checkpoint (`last_keyset_val`) e na próxima rodada usa ele como filtro. Performance constante, independente do tamanho da tabela.

### Padrão C — pg_dump + restore (volume grande)

Fora do escopo deste manual via MCP. Devolva pro sponsor humano:

> "Tabela X tem N rows. Recomendo migrar via pg_dump direto:
> ```bash
> pg_dump -h <lovable-host> -U postgres -d postgres \
>   -t public.<nome> --data-only --column-inserts \
>   --on-conflict-do-nothing > /tmp/<nome>.sql
>
> psql -h <oficial-host> -U postgres -d postgres -f /tmp/<nome>.sql
> ```
> Posso continuar com as outras tabelas via MCP enquanto você roda isso."

---

## D.9 — Tarefa 5: Restore com `ON CONFLICT` {#d9-restore}

**Princípio**: todo INSERT deve ser **idempotente**. Se rodar duas vezes, não duplica.

### Estratégia universal — `ON CONFLICT (pk) DO NOTHING`

```sql
INSERT INTO public.<nome> (col1, col2, col3, ...)
VALUES
  ('v1a', 'v1b', 'v1c'),
  ('v2a', 'v2b', 'v2c'),
  -- ... 1000 linhas ...
ON CONFLICT (id) DO NOTHING
RETURNING 1;
-- O RETURNING permite contar inserções reais
```

### Estratégia "update se mais recente"

Se você está re-rodando e quer **sobrescrever** com a versão mais recente do Lovable:

```sql
INSERT INTO public.<nome> (id, col1, col2, updated_at, ...)
VALUES (...)
ON CONFLICT (id) DO UPDATE
   SET col1       = EXCLUDED.col1,
       col2       = EXCLUDED.col2,
       updated_at = EXCLUDED.updated_at
   WHERE EXCLUDED.updated_at > public.<nome>.updated_at;  -- só se mais novo
```

### Como transformar JSON do dump em INSERT bulk

Em Python via `bash_tool`:

```python
import json

rows = json.loads(dump_response)["rows"]  # lista de dicts

cols = list(rows[0].keys())
values = []
for r in rows:
    parts = []
    for c in cols:
        v = r[c]
        if v is None:
            parts.append("NULL")
        elif isinstance(v, bool):
            parts.append("TRUE" if v else "FALSE")
        elif isinstance(v, (int, float)):
            parts.append(str(v))
        elif isinstance(v, (dict, list)):
            # jsonb
            parts.append("'" + json.dumps(v).replace("'", "''") + "'::jsonb")
        else:
            # text, uuid, timestamp — string quoted
            parts.append("'" + str(v).replace("'", "''") + "'")
    values.append("(" + ", ".join(parts) + ")")

sql = f"""
INSERT INTO public.{table_name} ({', '.join(cols)})
VALUES
{',\n'.join(values)}
ON CONFLICT (id) DO NOTHING;
"""
```

⚠️ **Cuidado com escape**: aspas simples em strings precisam virar duas aspas simples. Em jsonb, escape `'` antes de virar texto.

### Cuidado com triggers `BEFORE INSERT`

Algumas triggers no Oficial podem **modificar** ou **rejeitar** rows na inserção. Tipos comuns:

| Trigger | Efeito | O que fazer |
|---|---|---|
| Auto-set `created_at = now()` | Sobrescreve o `created_at` do Lovable | Desabilitar trigger durante migração ou usar `SET LOCAL` |
| Geração de `slug` | Sobrescreve o slug existente | Mesmo |
| Validação de FK soft | Pode rejeitar se a FK não foi migrada ainda | Migre o pai primeiro (Tarefa 2) |
| `digest()`/`gen_random_uuid()` | Gera valor novo, perde o original | Desabilitar trigger ou usar `OVERRIDING SYSTEM VALUE` |

Como desabilitar/reabilitar trigger em torno do INSERT bulk:

```sql
ALTER TABLE public.<nome> DISABLE TRIGGER <nome_da_trigger>;
-- INSERT bulk aqui
ALTER TABLE public.<nome> ENABLE TRIGGER <nome_da_trigger>;
```

**Nunca esqueça** de reabilitar — coloque num bloco `BEGIN ... EXCEPTION ... END` se for sensível.

### Migração completa de uma tabela — template padrão

```sql
-- Para cada chunk de 1000 rows do lovable_dump_data:

DO $$
DECLARE
  v_inserted bigint;
  v_conflict bigint;
BEGIN
  -- Opcional: desabilita triggers
  ALTER TABLE public.<nome> DISABLE TRIGGER USER;

  WITH ins AS (
    INSERT INTO public.<nome> (id, col1, col2, ...)
    VALUES
      ('uuid-1', 'v1a', 'v1b'),
      ('uuid-2', 'v2a', 'v2b'),
      -- ... até 1000 ...
    ON CONFLICT (id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM ins;

  v_conflict := 1000 - v_inserted;  -- ajuste para tamanho real do chunk

  -- Reabilita triggers
  ALTER TABLE public.<nome> ENABLE TRIGGER USER;

  -- Checkpoint
  PERFORM public.fn_migration_checkpoint(
    '<nome>', 'B_dump', 'running',
    p_offset := <offset_final>,
    p_inserted := v_inserted,
    p_conflict := v_conflict
  );
END $$;
```

---

## D.10 — Tarefa 6: Validação pós-migração {#d10-validacao}

**Princípio**: confiança não substitui evidência. Sempre valide.

### Validação 1 — Counts batem

```sql
-- No Lovable
SELECT count(*) AS lovable_count FROM public.<nome>;

-- No Oficial
SELECT count(*) AS oficial_count FROM public.<nome>;
```

Esperado: `oficial_count >= lovable_count` (Oficial pode ter rows que o Lovable não tem por design — Oficial é SSOT).

**Para tabelas migradas agora**: diferença deve ser 0.

### Validação 2 — Sample hash (10 rows aleatórias)

```sql
-- No Lovable
SELECT md5(string_agg(t::text, ',' ORDER BY id)) AS hash_amostra
  FROM (SELECT * FROM public.<nome> ORDER BY id LIMIT 10) t;

-- No Oficial (mesmas 10 PKs)
SELECT md5(string_agg(t::text, ',' ORDER BY id)) AS hash_amostra
  FROM (SELECT * FROM public.<nome>
        WHERE id IN (<ids capturados acima>)
        ORDER BY id) t;
```

Hashes devem bater. Se não baterem, alguma trigger reescreveu o conteúdo.

### Validação 3 — Integridade de FKs

```sql
-- No Oficial — toda FK precisa ter pai válido
SELECT count(*) AS orfas_fk
  FROM public.order_items oi
 WHERE oi.order_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = oi.order_id);
```

Resultado esperado: **0 órfãs**. Se >0, você inseriu filhos antes dos pais — refaça a ordem topológica.

### Validação 4 — RLS funcionando

```sql
-- Simula leitura como authenticated
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"<user-uuid-real>", "role":"authenticated"}';
SELECT count(*) FROM public.<nome>;
RESET ROLE;
```

Deve retornar o que o usuário consegue ler (não necessariamente todo o count).

### Validação 5 — Update timestamps preservados

```sql
-- Compare top 5 mais recentes
-- Lovable
SELECT id, updated_at FROM public.<nome> ORDER BY updated_at DESC LIMIT 5;
-- Oficial
SELECT id, updated_at FROM public.<nome> WHERE id IN (<mesmos>);
```

Os `updated_at` devem ser idênticos. Se o Oficial tiver `now()` em todos, alguma trigger sobrescreveu — você esqueceu de desabilitar.

### Relatório final

Compile num markdown `docs/redeploy/FASE-5-DATA-MIGRATION-LOG.md`:

```markdown
# Fase 5 — Log de migração de dados

| Tabela | Estratégia | Source | Migradas | Conflict | Status | Validação |
|---|---|---:|---:|---:|---|---|
| products | — | 4812 | 0 | 0 | ⏭️ allowlist | n/a |
| mockup_jobs | B | 1250 | 1250 | 0 | ✅ done | counts+hash OK |
| mockup_templates | A | 78 | 78 | 0 | ✅ done | counts+hash OK |
| quote_items | B | 18430 | 18430 | 0 | ✅ done | counts+hash OK, 0 FK orfãs |
| order_items | A | 0 | 0 | 0 | ⏭️ vazia | n/a |
```

---

## D.11 — Troubleshooting específico de dados {#d11-troubleshooting}

### Problema: INSERT bulk falha com "duplicate key"

**Causa**: `ON CONFLICT` está faltando ou aponta para coluna errada.

**Solução**: confirme qual é a PK real:
```sql
SELECT a.attname AS col
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
 WHERE i.indrelid = 'public.<nome>'::regclass AND i.indisprimary;
```

Use o nome exato no `ON CONFLICT (<col>)`.

### Problema: INSERT falha com "violates foreign key constraint"

**Causa**: a tabela-pai não foi migrada ainda.

**Solução**: pare. Refaça a ordem topológica (Tarefa 2). Migre a tabela-pai primeiro.

**Workaround temporário** (não recomendado):
```sql
ALTER TABLE public.<nome> DISABLE TRIGGER ALL;  -- desabilita FKs também
-- INSERT
ALTER TABLE public.<nome> ENABLE TRIGGER ALL;
-- depois rode a validação 3 (FK órfãs)
```

### Problema: `auth.uid()` FK quebra porque user não existe no Oficial

**Causa**: você está inserindo dados que referenciam `auth.users(id)` mas o usuário só existe no Lovable.

**Solução 1** (preferida): recrie os usuários no Oficial antes:
```sql
-- Capture do Lovable
SELECT id, email, raw_user_meta_data, created_at FROM auth.users;

-- Recrie no Oficial via Supabase Admin API (não pode ser SQL direto em auth.users)
-- supabase.auth.admin.createUser({ id, email, ... })
```

**Solução 2**: tabela de mapping + rewrite das FKs:
```sql
CREATE TABLE public.user_id_map (
  lovable_user_id uuid PRIMARY KEY,
  oficial_user_id uuid NOT NULL UNIQUE
);

-- No INSERT, traduza:
INSERT INTO public.<nome> (user_id, ...)
SELECT m.oficial_user_id, ... FROM <fonte> j
  JOIN public.user_id_map m ON m.lovable_user_id = j.user_id;
```

### Problema: `lovable_dump_data` retorna timeout

**Causa**: tabela grande ou colunas pesadas.

**Solução**: reduza `limit` de 1000 para 200 ou 100. Mais chunks, mas cada um termina antes do timeout.

### Problema: hash não bate pós-migração

**Causa típica**: trigger `BEFORE INSERT` reescreveu colunas (geralmente `created_at`, `updated_at`, `slug`, `hash`).

**Solução**:
1. Identifique a trigger ativa: `SELECT * FROM pg_trigger WHERE tgrelid = 'public.<nome>'::regclass AND NOT tgisinternal;`
2. Desabilite com `ALTER TABLE ... DISABLE TRIGGER <nome>;`
3. Refaça o INSERT do chunk afetado
4. Reabilite

### Problema: enum value mismatch (`invalid input value for enum`)

**Causa**: o enum no Oficial não tem todos os valores que o Lovable tem.

**Solução**: rode primeiro:
```sql
SELECT DISTINCT unnest_enum_values FROM (
  SELECT unnest(enum_range(NULL::public.<enum_name>))::text AS unnest_enum_values
) t;
```

Adicione os valores faltantes:
```sql
ALTER TYPE public.<enum_name> ADD VALUE IF NOT EXISTS '<valor>';
-- IMPORTANTE: commit antes de usar o valor (chamadas MCP separadas)
```

### Problema: `column does not exist` no INSERT bulk

**Causa**: o schema não está 100% alinhado. Você pulou a Fase 3.

**Solução**: pare a migração de dados. Volte para Fase 3 e zere o `schema_diff`. Não tem como migrar dados em schema divergente.

### Problema: INSERT bulk explode "stack depth limit exceeded"

**Causa**: chunk muito grande (>5000 VALUES) ou jsonb gigantes.

**Solução**: reduza chunk de 1000 para 200. Ou divida por colunas (INSERT só PKs + UPDATE depois).

### Problema: migração trava em "running" indefinidamente

**Causa**: chamada MCP foi interrompida no meio.

**Solução**: identifica o checkpoint, marca como `failed` manualmente, retoma do `last_offset`:
```sql
UPDATE public.data_migration_log
   SET status = 'failed', error_message = 'Sessão interrompida — manual recovery'
 WHERE table_name = '<nome>' AND status = 'running';
```

---

## D.12 — Templates prontos {#d12-templates}

### Template — Loop completo de uma tabela (Estratégia B)

```sql
-- =============================================================================
-- Migração de DADOS: <nome>
-- Estratégia: B (lovable_dump_data em chunks)
-- Pré-validado: schema alinhado, FKs reconciliadas
-- =============================================================================

-- 1) Marca início
SELECT public.fn_migration_checkpoint('<nome>', 'B_dump', 'running');

-- 2) Loop (Claude executa):
--    chunk_offset = 0
--    while true:
--      lovable_dump_data(table='<nome>', limit=1000, offset=chunk_offset)
--      build INSERT bulk com ON CONFLICT DO NOTHING
--      apply_migration(insert_sql)
--      fn_migration_checkpoint(p_offset = chunk_offset + len(chunk))
--      chunk_offset += 1000
--      if len(chunk) < 1000: break

-- 3) Finaliza
SELECT public.fn_migration_checkpoint('<nome>', 'B_dump', 'done');

-- 4) Validação
SELECT
  (SELECT count(*) FROM public.<nome>)  AS oficial_count,
  (SELECT rows_inserted FROM public.data_migration_log
    WHERE table_name='<nome>' AND strategy='B_dump') AS migrated;
-- Diferença esperada: 0
```

### Template — Migração de tabela com FK para auth.users

```sql
-- =============================================================================
-- Migração de DADOS: <nome> (com FK para auth.users)
-- Pré-requisito: user_id_map populada
-- =============================================================================

-- 1) Garantir mapping
SELECT count(*) AS mapped_users FROM public.user_id_map;
-- Se mapped_users < lovable_users_count, parar e completar o mapping antes.

-- 2) INSERT com rewrite do user_id
INSERT INTO public.<nome> (id, user_id, col1, col2, ...)
SELECT
  src.id,
  m.oficial_user_id,  -- ← rewrite aqui
  src.col1,
  src.col2,
  ...
FROM <source_temp_table> src
JOIN public.user_id_map m ON m.lovable_user_id = src.user_id
ON CONFLICT (id) DO NOTHING;
```

### Template — RPC dump no Lovable (Estratégia A)

```sql
-- =============================================================================
-- No Lovable, criar RPC dump_table_<nome>
-- Só para tabelas <1k rows (payload <1MB)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.dump_table_<nome>()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
    FROM public.<nome> t;
$$;

GRANT EXECUTE ON FUNCTION public.dump_table_<nome>() TO anon, authenticated;

COMMENT ON FUNCTION public.dump_table_<nome>() IS
  'TEMPORÁRIA para migração de dados Lovable→Oficial. Dropar após Fase 5.';
```

⚠️ Não esqueça: depois da migração, **drope todas as RPCs `dump_table_*` no Lovable** — elas expõem dados via anon key.

### Template — Limpeza pós-migração

```sql
-- No Lovable, após Fase 5 completa, dropar RPCs temporárias
DROP FUNCTION IF EXISTS public.dump_table_<nome1>() CASCADE;
DROP FUNCTION IF EXISTS public.dump_table_<nome2>() CASCADE;
-- ... etc.
```

### Template — Relatório de migração

```markdown
# Fase 5 — Migração de dados — Log de Execução

**Data**: <data>
**Operador**: Agente Claude via Lovable MCP + Supabase MCP
**Tabelas migradas**: <n>
**Linhas totais migradas**: <soma>
**Tempo total**: <minutos>

## Snapshot por tabela

| Tabela | Estratégia | Source | Migrated | Conflict | Hash match | FK órfãs | Status |
|---|---|---:|---:|---:|:---:|---:|---|
| ... | ... | ... | ... | ... | ✅/❌ | 0 | ✅/❌ |

## Pendências
- <tabelas não migradas e motivo>

## Lições aprendidas
- <issues encontrados e como resolveu>

## Limpeza pós-execução
- [ ] RPCs `dump_table_*` dropadas no Lovable
- [ ] `user_id_map` mantida (referência permanente) ou dropada
- [ ] `data_migration_log` arquivada
```

---

## D.13 — Checklist final {#d13-checklist}

Antes de considerar a migração de dados concluída:

### Pré-migração
- [ ] Schema 100% alinhado (Gate CI `has_drift = false`)
- [ ] FKs reconciliadas (ordem topológica calculada)
- [ ] `auth.users` sincronizados (se aplicável)
- [ ] Inventário de volumes feito
- [ ] Estratégia A/B/C decidida por tabela
- [ ] `data_migration_log` e `fn_migration_checkpoint` criados
- [ ] Sponsor confirmou LGPD/GDPR OK para mover PII

### Durante a migração
- [ ] Triggers críticas identificadas e desabilitadas onde necessário
- [ ] Chunks ≤1000 (ou ajustado para 200 se houver timeout)
- [ ] Checkpoint atualizado depois de cada chunk
- [ ] `ON CONFLICT` presente em todo INSERT
- [ ] Logs do MCP sendo monitorados

### Pós-migração
- [ ] Counts batem (oficial >= lovable, exceto allowlist)
- [ ] Sample hash bate (10 rows aleatórias por tabela)
- [ ] FK órfãs = 0
- [ ] RLS funciona (`SET LOCAL ROLE authenticated` retorna esperado)
- [ ] Updated_at preservados (não foram sobrescritos por trigger)
- [ ] Triggers reabilitadas
- [ ] RPCs `dump_table_*` dropadas no Lovable
- [ ] Relatório `FASE-5-DATA-MIGRATION-LOG.md` commitado
- [ ] `data_migration_log` arquivada ou mantida como histórico

### Estado terminal
- [ ] Todas as tabelas elegíveis com `status = 'done'`
- [ ] Tabelas não elegíveis com `status = 'skipped'` + reason
- [ ] Sponsor avisado: dados copiados, mas app **continua** escrevendo no Lovable (limitação do `is_managed_by_lovable`)

---

## Apêndice D.A — Diagrama BPM visual

```
                     ┌──────────────────────────┐
                     │  FASE 5 — Dados          │
                     │  (após Fase 4 verde)     │
                     └──────────┬───────────────┘
                                │
                                ▼
                ┌──────────────────────────────────┐
                │ T1: Inventário de volumes        │
                │ - count(*) por tabela            │
                │ - decide A/B/C por tabela        │
                └──────────────┬───────────────────┘
                               │
                               ▼
                ┌──────────────────────────────────┐
                │ T2: Ordem topológica             │
                │ - resolver FKs (recursive CTE)   │
                │ - detectar/quebrar ciclos        │
                └──────────────┬───────────────────┘
                               │
                               ▼
                ┌──────────────────────────────────┐
                │ T3: Tabela de checkpoint         │
                │ data_migration_log               │
                │ fn_migration_checkpoint()        │
                └──────────────┬───────────────────┘
                               │
                               ▼
              ┌────────────────┴────────────────┐
              │ Para cada tabela (ordem topo):  │
              │                                 │
              ▼                                 ▼
   ┌──────────────────┐                ┌──────────────────┐
   │ Estratégia A     │                │ Estratégia B     │
   │ RPC HTTP, 1 shot │                │ dump_data chunks │
   └────────┬─────────┘                └────────┬─────────┘
            │                                   │
            └───────────────┬───────────────────┘
                            │
                            ▼
                ┌──────────────────────────────────┐
                │ T5: Restore com ON CONFLICT      │
                │ - INSERT bulk idempotente        │
                │ - desabilitar triggers se prec.  │
                │ - update checkpoint              │
                └──────────────┬───────────────────┘
                               │
                               ▼
                ┌──────────────────────────────────┐
                │ T6: Validação                    │
                │ - counts match                   │
                │ - sample hash match              │
                │ - FK órfãs = 0                   │
                │ - RLS funciona                   │
                └──────────────┬───────────────────┘
                               │
                               ▼
                       [FIM] dados sincronizados
```

---

## Apêndice D.B — KPIs sugeridos da migração de dados

| KPI | Meta | Como medir |
|---|---|---|
| Rows migrados / total elegíveis | 100% | `SUM(rows_inserted) / SUM(rows_source)` em `data_migration_log` |
| Tabelas com `status='done'` | 100% das elegíveis | `count(*) FILTER (WHERE status='done')` |
| Tempo médio por 1000 rows | <30s | `(finished_at - started_at) / (rows_inserted / 1000.0)` |
| Hash mismatches detectados | 0 | Validação 2 manual |
| FK órfãs pós-migração | 0 | Validação 3 — por tabela com FK |

---

## Apêndice D.C — Glossário específico de dados

| Termo | Significado |
|---|---|
| **Ordem topológica** | Ordem dos INSERTs que respeita as FKs (pais antes de filhos) |
| **Idempotência** | Propriedade do INSERT: rodar 2x não cria duplicatas (via ON CONFLICT) |
| **Checkpoint** | Linha em `data_migration_log` que permite retomar uma migração interrompida |
| **Keyset pagination** | Pagination por PK em vez de OFFSET (performance constante) |
| **Hash de amostra** | `md5(string_agg(...))` de 10 rows pra confirmar que os dados não foram alterados |
| **Rewrite de FK** | Trocar `user_id` lovable por `user_id` oficial via tabela de mapping |
| **PII** | Personally Identifiable Information — dados sob proteção LGPD/GDPR |

---

**Fim do Apêndice D.**

Se você é o Claude que está executando essa fase agora: **dados são mais delicados que schema**. Schema você refaz com um `DROP CASCADE + CREATE`. Dados perdidos são perdidos. **Sempre** comece pelo checkpoint. **Sempre** use `ON CONFLICT`. **Sempre** valide hash de amostra antes de marcar como `done`.

Boa migração e que nenhuma FK fique órfã. 🚀