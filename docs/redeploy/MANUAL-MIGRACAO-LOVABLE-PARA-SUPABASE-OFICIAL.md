# Manual de Migração: Lovable Cloud → Supabase Oficial (SSOT)

**Autor original**: Claude (instância 2026-05-22) em parceria com Abner Silva (Pink e Cérebro)
**Última atualização**: 2026-05-22
**Aplicabilidade**: qualquer projeto Lovable Cloud que precise migrar para um Supabase próprio externo
**Tempo estimado total**: 3–6 horas para um projeto médio (8 horas se houver muito drift)

---

## ⚡ Como ler este manual

Este é um manual de execução escrito por uma instância de Claude, para outras instâncias de Claude que irão repetir essa migração em projetos diferentes. Ele assume:

- Você (Claude) tem acesso a MCPs: `LOVABLE - MCP`, `SUPABASE - <PROJETO>` (o oficial), `GITHUB - MCP - FOREVER`, e idealmente algum MCP para o Bright Data ou Web Fetch para inspecionar o repo.
- O sponsor humano (Abner ou alguém no papel dele) opera no modo "**idealiza → realiza**": vai te dar um pedido alto-nível, espera você executar com excelência, e só intervém em decisões destrutivas.
- O sponsor tem instrução padrão: **"simule exaustivamente antes de executar; melhorias uma de cada vez com excelência."**

**Tom**: você é um agente de gestão por processos. Linguagem clara, didática, com exemplos. Sempre quebre em fases, valide antes/durante/depois, documente tudo.

**Não pule etapas**. Cada uma existe porque uma execução anterior teve um problema específico. Os exemplos de SQL e workflows aqui são exatamente os usados na primeira migração bem-sucedida (Promo Gifts V4).

---

## 📑 Índice

1. [O cenário e por que esse manual existe](#1-o-cenário)
2. [A descoberta arquitetural crítica](#2-descoberta-arquitetural)
3. [Pré-requisitos antes de começar](#3-pré-requisitos)
4. [Mapa das fases](#4-mapa-das-fases)
5. [Fase 0 — Descoberta inicial](#5-fase-0--descoberta-inicial)
6. [Fase 1 — Inventário e diff de schemas](#6-fase-1--inventário-e-diff-de-schemas)
7. [Fase 2 — Migrar tabelas órfãs, funções e crons do Lovable → Oficial](#7-fase-2)
8. [Fase 3 — Corrigir drift coluna-a-coluna em waves](#8-fase-3)
9. [Fase 3.5 — Drift residual + allowlist](#9-fase-35)
10. [Fase 4 — Gate CI de schema drift (cron diário)](#10-fase-4)
11. [Fase 1.1 — Drop de tabelas legacy "fantasma"](#11-fase-11)
12. [Limitação conhecida — desbloqueio definitivo do app](#12-limitação-conhecida)
13. [Padrões e princípios](#13-padrões-e-princípios)
14. [Templates de SQL prontos](#14-templates-prontos)
15. [Troubleshooting](#15-troubleshooting)
16. [Checklist final de aceitação](#16-checklist-final)

---

> ⚠️ **Por questão de tamanho, esse manual está dividido em 2 partes no repo:**
> - **PARTE 1** (este arquivo): Seções 1-7 (Cenário, Descoberta arquitetural, Pré-requisitos, Mapa, Fases 0/1/2)
> - **PARTE 2** ([MANUAL-PARTE-2.md](./MANUAL-PARTE-2.md)): Seções 8-16 (Fases 3/3.5/4/1.1, Limitações, Padrões, Templates, Troubleshooting, Checklist, Apêndices)
>
> **Leia as duas partes na ordem antes de executar.**

---

## 1. O cenário {#1-o-cenário}

### O contexto típico

O usuário começou com um projeto no Lovable Cloud que usa o Supabase **interno gerenciado pelo Lovable**. Com o tempo:

- O projeto cresceu (centenas de tabelas).
- O usuário quer migrar para um **Supabase próprio externo** (chamado "Oficial" ou "SSOT") porque quer controle total, evitar lock-in, ou consolidar dados em um único banco que outros serviços também leem.
- Já tentou ajustar o `src/integrations/supabase/client.ts` no GitHub apontando pro Supabase externo, mas **o app continua escrevendo no banco do Lovable**.

Esse manual existe porque essa migração tem armadilhas não óbvias.

### O que esse manual NÃO faz

- **Não migra o app definitivamente** para o Supabase externo (impossível via banco — ver [Seção 12](#12-limitação-conhecida)).
- **Não migra dados** entre os bancos (esse manual cuida do schema; migração de dados é tópico separado, faça depois do schema estar idêntico).
- **Não substitui o sponsor humano** em decisões destrutivas — sempre peça confirmação antes de DROP ou TRUNCATE em tabelas com dados.

### O que esse manual entrega

1. **Schemas alinhados** entre Lovable interno e Supabase oficial.
2. **Gate CI automatizado** que detecta drift diariamente.
3. **Allowlist auditável** das divergências aceitáveis por design.
4. **Documentação completa no GitHub** (10+ arquivos em `supabase/migrations/` e `docs/redeploy/`).
5. **Estado terminal verde** (`has_drift = false`) na monitoria.

---

## 2. A descoberta arquitetural crítica {#2-descoberta-arquitetural}

**Leia isso ANTES de prometer ao usuário que vai "mover o app pro Supabase externo".**

O Lovable Cloud mantém um campo `is_managed_by_lovable: true` na configuração interna do projeto. Quando esse flag é verdadeiro:

1. O Lovable Cloud **mantém uma config própria** com `supabase_project_id` apontando para o banco interno (`pqpdolkae...` ou similar).
2. **No build do app**, o Lovable Cloud **injeta essa config no bundle**, sobrescrevendo o `client.ts` do repo.
3. **Não existe interface pública** no Lovable para mudar esse `supabase_project_id` para apontar para um Supabase externo.
4. **Resultado**: por mais que o `client.ts` do repo aponte para o oficial, o app **runtime** continua escrevendo no Lovable Cloud interno.

### Como confirmar isso no projeto que você está trabalhando

```python
# Via Lovable MCP
LOVABLE - MCP:lovable_get_integrations(project_id="<id-do-projeto-lovable>")
```

No retorno, procure:

```json
"supabase": {
  "supabase_project_id": "<id-do-banco-interno>",
  "publishable_key": "<anon-key>",
  "is_managed_by_lovable": true   // ← AQUI
}
```

Se `is_managed_by_lovable: true`, a migração **só pode chegar até "preparar o destino"**, não "mudar o tráfego do app". Avise o usuário no início.

### Por que esse manual ainda vale a pena mesmo com essa limitação

Mesmo sem conseguir mudar o tráfego do app via Lovable, alinhar os schemas tem valor real:

- **Backup automático**: o Supabase externo recebe sync periódico do Lovable e fica como cópia consistente.
- **Pronto para self-deploy**: se o usuário decidir sair do Lovable (Vercel/Netlify/Cloudflare), o banco externo já está consistente.
- **Outras integrações**: serviços externos (CRM, BI, n8n) podem ler do Supabase externo sem passar pelo Lovable.
- **Disaster recovery**: se o Lovable cair ou o usuário perder acesso, o Supabase externo é a verdade.
- **Detecção de drift**: o Gate CI alerta sempre que o Lovable criar algo novo, mantendo controle.

---

## 3. Pré-requisitos antes de começar {#3-pré-requisitos}

### Acesso e MCPs

Confirme com o sponsor humano:

- [ ] **ID do projeto Lovable** (formato UUID, ex: `4994fc19-8c1e-4249-80b9-ddccaf31f58d`)
- [ ] **ID do Supabase externo "Oficial"** (subdomínio, ex: `doufsxqlfjyuvxuezpln`)
- [ ] **ID do Supabase interno "Lovable Cloud"** (descoberto via `lovable_get_integrations`)
- [ ] **Repo GitHub** do projeto (formato `owner/repo`)
- [ ] **MCP do Supabase externo** habilitado e funcional (use `tool_search "supabase nome-do-projeto"` para confirmar)
- [ ] **MCP do GitHub** habilitado
- [ ] **MCP do Lovable** habilitado

### Princípio fundamental — Decision 010

**O banco oficial é a verdade (SSOT). Migrations vão para o banco direto via MCP, depois são registradas no `supabase_migrations.schema_migrations`, depois documentadas no repo.**

`supabase db push` está **proibido** porque:

- O repo geralmente tem centenas de migrations defasadas vs. as aplicadas
- O drift entre `repo/supabase/migrations/` e `supabase_migrations.schema_migrations` é tipicamente >90%
- Forçar push reescreve a história e quebra o estado atual

### Princípio fundamental — Decision 012

Algumas migrations específicas só rodam direto no Lovable (porque alteram o banco interno). Essas vão no repo como **documentação** (`-- LOVABLE-ONLY, doc-only`), nunca para ser executadas via CI.

---

## 4. Mapa das fases {#4-mapa-das-fases}

```
┌──────────────────────────────────────────────────────────────────┐
│ Fase 0   Descoberta inicial — mapear os 3 ambientes (~30 min)   │
└──────────────────────────────────────────────────────────────────┘
                              │
┌──────────────────────────────────────────────────────────────────┐
│ Fase 1   Inventário + diff de schemas (~1h)                     │
│          Saída: lista de tabelas com drift, classificadas       │
└──────────────────────────────────────────────────────────────────┘
                              │
┌──────────────────────────────────────────────────────────────────┐
│ Fase 2   Migrar tabelas órfãs, funções e crons (~1h)            │
│          Para tabelas que existem só num lado mas deveriam      │
│          existir nos dois                                        │
└──────────────────────────────────────────────────────────────────┘
                              │
┌──────────────────────────────────────────────────────────────────┐
│ Fase 3   Corrigir drift coluna-a-coluna em waves (~2h)          │
│          Wave 3.1   Quick wins (colunas faltantes)              │
│          Wave 3.2   Convenções de naming (client_* vs cust_*)   │
│          Wave 3.3   Conflitos graves (tipos, PKs)                │
│          Wave 3.4   Catástrofes (refactor destrutivo)            │
└──────────────────────────────────────────────────────────────────┘
                              │
┌──────────────────────────────────────────────────────────────────┐
│ Fase 3.5  Drift residual + allowlist (~40 min)                  │
│          Tabelas que não dá para alinhar (cache, infra)         │
└──────────────────────────────────────────────────────────────────┘
                              │
┌──────────────────────────────────────────────────────────────────┐
│ Fase 4   Gate CI de schema drift (~1h)                          │
│          pg_cron + função orquestradora + alerta a admins        │
└──────────────────────────────────────────────────────────────────┘
                              │
┌──────────────────────────────────────────────────────────────────┐
│ Fase 1.1  DROP tabelas legacy "fantasma" (~30 min)              │
│          Limpeza final, Gate CI vira verde                       │
└──────────────────────────────────────────────────────────────────┘
```

**A numeração não é sequencial cronológica** — é por **ordem de descoberta**. As fases 0/1/2/3 vêm primeiro, depois 3.5 (residual descoberto pelo Gate CI), depois 4 (o próprio Gate CI), depois 1.1 (limpeza identificada pelo Gate CI). Essa ordem é importante: 1.1 vem **depois** do Gate CI porque é o Gate CI que identifica o que sobrou.

---

## 5. Fase 0 — Descoberta inicial {#5-fase-0--descoberta-inicial}

**Objetivo**: mapear os 3 ambientes (Lovable interno, Oficial, qualquer outro Supabase em uso) e confirmar que você está olhando para os bancos certos.

### Passo 5.1 — Confirmar os hosts dos bancos

Os IDs dos projetos sozinhos não bastam — sempre confirme via host IPv6/IPv4 que são bancos físicos diferentes:

```sql
-- No banco oficial via MCP correspondente:
SELECT current_database()                       AS db,
       inet_server_addr()::text                 AS host,
       current_setting('server_version_num')    AS pg_version;
```

```sql
-- No banco Lovable via lovable_db_query (mesmo SQL):
-- ... mesmo SQL ...
```

**Esperado**: hosts diferentes. Se forem iguais, **pare** e investigue — você pode estar acidentalmente apontando os dois MCPs para o mesmo banco.

### Passo 5.2 — Confirmar `is_managed_by_lovable`

```python
LOVABLE - MCP:lovable_get_integrations(project_id="<uuid>")
```

Documente no relatório:

- `supabase_project_id` interno
- `publishable_key` (anon JWT) — você vai precisar dela na Fase 4
- `is_managed_by_lovable` (`true`/`false`)

### Passo 5.3 — Confirmar o client.ts atual

```python
LOVABLE - MCP:lovable_get_file(
  project_id="<uuid>",
  path="src/integrations/supabase/client.ts"
)
```

Veja para qual `SUPABASE_URL` o repo aponta. Se já aponta pro Oficial mas o app ainda escreve no Lovable, **confirme com o usuário que ele já entende que isso é o efeito do `is_managed_by_lovable: true`**.

### Passo 5.4 — Confirmar o repo GitHub

```python
GITHUB - MCP - FOREVER:github_get_repo(owner="<org>", repo="<repo>")
```

Confirme branch principal (geralmente `main`), branch protection (geralmente PENDING), e contadores.

### Saída esperada da Fase 0

Um bloco de descoberta documentado, idealmente em `docs/redeploy/FASE-0-DISCOVERY.md`:

```markdown
# Fase 0 — Descoberta

## Ecossistema mapeado
| Banco | Project ID | Host | Função |
|---|---|---|---|
| Lovable Cloud interno | <id> | <host> | App escreve aqui (managed) |
| Supabase Oficial (SSOT) | <id> | <host> | Destino pretendido |

## Lovable integration config
- supabase_project_id: <id>
- is_managed_by_lovable: true ← CONFIRMADO
- publishable_key: eyJh...(rotacionar se exposta)

## Implicação arquitetural
O Lovable Cloud injeta config própria no build. Migração de tráfego do app
não é possível via MCP — só via PR removendo dependência do Lovable Cloud.
Próximas fases preparam o destino (Oficial) para receber o tráfego quando
o desbloqueio acontecer.
```

---

## 6. Fase 1 — Inventário e diff de schemas {#6-fase-1--inventário-e-diff-de-schemas}

**Objetivo**: identificar exatamente quais tabelas existem em cada banco, quais existem nos dois mas com schema divergente.

### Passo 6.1 — Função de signature reutilizável

Esta função vai ser usada na Fase 4 também. Crie nos **dois bancos**:

```sql
CREATE OR REPLACE FUNCTION public.get_public_schema_signatures()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(jsonb_object_agg(table_name, sig), '{}'::jsonb)
    FROM (
      SELECT table_name,
             string_agg(column_name || ':' || data_type, ',' ORDER BY column_name) AS sig
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name NOT LIKE '\_backup\_%' ESCAPE '\'
         AND table_name NOT LIKE 'pg\_%'        ESCAPE '\'
       GROUP BY table_name
    ) s;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_schema_signatures() TO anon, authenticated;
```

**Por que `SECURITY DEFINER` + `search_path` fixo**: é um requisito de hardening do Supabase. Sem isso, advisor flagra como vulnerabilidade.

### Passo 6.2 — Capturar signatures dos dois lados

```sql
-- No oficial:
SELECT public.get_public_schema_signatures() AS oficial_sigs;

-- No Lovable:
SELECT public.get_public_schema_signatures() AS lovable_sigs;
```

Salve os dois JSONs (são grandes — use `tool_results` ou bash para processar).

### Passo 6.3 — Computar o diff

Use Python local (via `bash_tool`) para gerar a tabela de diff. Exemplo:

```python
import json

oficial = {...}  # output do passo 6.2 oficial
lovable = {...}  # output do passo 6.2 lovable

only_oficial = set(oficial) - set(lovable)
only_lovable = set(lovable) - set(oficial)
both        = set(oficial) & set(lovable)
drift       = {t: (oficial[t], lovable[t]) for t in both if oficial[t] != lovable[t]}

print(f"Tabelas só Oficial: {len(only_oficial)}")
print(f"Tabelas só Lovable: {len(only_lovable)}")
print(f"Tabelas com drift:  {len(drift)}")
```

### Passo 6.4 — Classificar o que está só num dos lados

Para cada tabela em `only_oficial` e `only_lovable`, decida:

| Categoria | Decisão típica |
|---|---|
| **Catálogo SSOT** (produtos, clientes, gravações, técnicas) | Mantém só no Oficial — o app vai consumir daqui |
| **Infra Lovable** (telemetria, simulation_logs) | Mantém só no Lovable — entra na allowlist depois |
| **Partição de log** (`_y2026m05`, etc.) | Mantém só no Lovable se for particionamento dele |
| **Órfã** (deveria existir nos dois) | Migra para o Oficial — vira tarefa da Fase 2 |
| **Legacy fantasma** (`_old`, substituída) | Marca para DROP na Fase 1.1 |

### Passo 6.5 — Classificar o drift

Para cada tabela em `drift`, parse a signature coluna-a-coluna:

```python
def parse_sig(s):
    return dict(c.split(':', 1) for c in s.split(','))

for table, (sig_o, sig_l) in drift.items():
    o_cols = parse_sig(sig_o)
    l_cols = parse_sig(sig_l)
    only_o = set(o_cols) - set(l_cols)
    only_l = set(l_cols) - set(o_cols)
    type_diff = {c: (o_cols[c], l_cols[c]) for c in set(o_cols) & set(l_cols)
                 if o_cols[c] != l_cols[c]}
    print(f"\n=== {table} ===")
    print(f"  só_oficial: {only_o}")
    print(f"  só_lovable: {only_l}")
    print(f"  tipo_diff:  {type_diff}")
```

### Passo 6.6 — Decidir a estratégia para cada tabela em drift

| Padrão | Ação | Wave da Fase 3 |
|---|---|---|
| Lovable tem colunas a mais (extras úteis) | Adicionar no Oficial | Wave 3.1 |
| Oficial tem colunas a mais (extras úteis) | Adicionar no Lovable | Wave 3.1 |
| Tipos diferentes (`text` vs `uuid`) | Cast no que estiver errado | Wave 3.3 |
| Naming diferente (`customer_*` vs `client_*`) | Renomear no que for menos usado | Wave 3.2 |
| Schemas radicalmente diferentes (B2B vs B2C) | Refactor destrutivo no que tiver menos dados | Wave 3.4 |
| Cache denormalizado por design | Allowlist | Fase 3.5 |

### Saída esperada da Fase 1

Um relatório `docs/redeploy/FASE-1-INVENTORY-DIFF.md` com:

- Contagens (tabelas oficial, tabelas lovable, drift, only_X)
- Lista classificada de cada tabela em drift com decisão proposta
- Plano de waves da Fase 3

---

## 7. Fase 2 — Migrar tabelas órfãs, funções e crons {#7-fase-2}

**Objetivo**: para tabelas/funções/crons que existem só no Lovable mas deveriam estar no Oficial (porque são lógica de negócio), recriá-las no Oficial.

### Quando essa fase faz sentido

- Tabelas de negócio que nasceram no Lovable mas viraram parte do core (ex: `mockup_jobs`)
- Funções utilitárias usadas por outras funções migradas (ex: `update_updated_at_column`)
- pg_cron jobs que devem rodar no Oficial também (ex: limpeza de logs antigos)

### Passo 7.1 — Capturar DDL completa do Lovable

Para cada tabela órfã:

```sql
-- No Lovable
SELECT
  'CREATE TABLE public.' || table_name || ' (' ||
  string_agg(
    quote_ident(column_name) || ' ' ||
    udt_name ||
    CASE WHEN character_maximum_length IS NOT NULL
         THEN '(' || character_maximum_length || ')' ELSE '' END ||
    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN column_default IS NOT NULL
         THEN ' DEFAULT ' || column_default ELSE '' END,
    ', ' ORDER BY ordinal_position
  ) || ');' AS ddl
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = '<nome>'
GROUP BY table_name;
```

Capture também:

- RLS policies (`pg_policies`)
- Índices (`pg_indexes`)
- Triggers (`information_schema.triggers`)
- Constraints (`information_schema.table_constraints`)

### Passo 7.2 — Aplicar no Oficial via `apply_migration`

**Use sempre `apply_migration`, não `execute_sql`**, porque `apply_migration` registra automaticamente em `supabase_migrations.schema_migrations`. Padrão de versão: `YYYYMMDDHHMMSS`.

```python
SUPABASE - <PROJETO>:apply_migration(
  name="migrate_orphan_<nome>_to_oficial",
  query="""
    CREATE TABLE public.<nome> (...);
    ALTER TABLE public.<nome> ENABLE ROW LEVEL SECURITY;
    CREATE POLICY ...;
    CREATE INDEX ...;
    -- etc.
  """
)
```

### Passo 7.3 — Funções: cuidar do `search_path`

Sempre adicione `SET search_path = pg_catalog, public` em funções `SECURITY DEFINER`:

```sql
CREATE OR REPLACE FUNCTION public.<nome>(...)
RETURNS <tipo>
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public  -- ← OBRIGATÓRIO
AS $$
  ...
$$;
```

Sem isso, o advisor de segurança do Supabase reclama em todas as próximas auditorias.

### Passo 7.4 — pg_cron jobs

```sql
-- Listar jobs no Lovable
SELECT jobid, schedule, command, jobname FROM cron.job;

-- Criar no Oficial (mesmo schedule e comando)
SELECT cron.schedule('nome-do-job', '<schedule>', $$<comando SQL>$$);
```

**Atenção**: jobs `cleanup-*` que rodam em ambos os bancos devem ter schedules **levemente diferentes** (ex: Lovable 02:00, Oficial 02:15) pra não saturar I/O simultaneamente se forem o mesmo cluster lógico.

### Saída esperada da Fase 2

- N migrations registradas em `schema_migrations` (uma por tabela órfã/função/cron)
- Relatório `docs/redeploy/FASE-2-EXECUTION-LOG.md` com a lista do que foi migrado

---

> **CONTINUA na PARTE 2** → [`MANUAL-PARTE-2.md`](./MANUAL-PARTE-2.md)
>
> Próxima parte cobre: Fases 3 (waves), 3.5 (allowlist), 4 (Gate CI), 1.1 (limpeza), Limitações, Padrões, Templates SQL, Troubleshooting, Checklist final.