# 🛠️ RECOVERY PLAN — Restauração de 65 tabelas faltantes

> **Status:** Fase 1 (Análise) COMPLETA — read-only, zero alterações no banco
> **Caminho escolhido:** A2 — 45 migrations corrigidas individualmente
> **Data:** 2026-05-10
> **Sponsor:** Joaquim (adm01@)
> **Modo:** PR por PR, com aprovação explícita

---

## 📊 Sumário Executivo

| Métrica | Valor |
|---|---|
| **Tabelas faltantes no banco atual** | **65** |
| **Migrations canônicas no repo** | **45** únicas |
| **Migrations que vão quebrar sem patch** | 5 (10 conflitos de tabela) |
| **FKs órfãs detectadas** | 2 (`company_contacts`, `product_groups` view) |
| **Migrations 100% idempotentes** | 22 (49%) |
| **Migrations que precisam patch** | 23 (51%) |
| **Tempo total estimado** | 3-4 dias |
| **Plano:** | 4 lotes (Crítico → Alto → Médio → Baixo) |

---

## 🎯 O QUE ESSE PLANO VAI ENTREGAR

Ao fim das 4 fases:

1. ✅ **65 tabelas recriadas** no banco atual com estrutura idêntica ao Lovable
2. ✅ **Carrinho do vendedor PERSISTE** (resolve bug crítico em produção hoje)
3. ✅ **Expert Chat salva histórico** corretamente
4. ✅ **Kit Builder colaborativo funcionando**
5. ✅ **Magic Up gerando ads** com histórico
6. ✅ **BI/Intelligence com analytics reais**
7. ✅ **Companies (CRM mini) operacional**
8. ✅ **Sistema de logs/auditoria restaurado**
9. ✅ **Resíduos da migração Lovable→atual eliminados**

---

## 🚨 PROBLEMAS DETECTADOS (e como resolver)

### Problema 1 — 5 migrations vão quebrar sem patch
Estas migrations tentam criar tabelas que **JÁ EXISTEM** no banco atual (sem `IF NOT EXISTS`):

| Migration | Conflita com | Plano |
|---|---|---|
| `20251231024837_*.sql` | `login_attempts` | Wrapper: `CREATE TABLE IF NOT EXISTS` na tabela conflitante |
| `20260304014416_*.sql` | `user_onboarding` | Skipar bloco `user_onboarding`, criar só os 4 outros |
| `20260305220938_*.sql` | `order_items` | Skipar bloco `order_items`, criar só os 5 outros |
| `20260317194959_*.sql` | `organizations` | Skipar bloco `organizations`, criar só `organization_members` |
| `20260412182408_*.sql` | `collections` | Skipar bloco `collections`, criar só `collection_items` |

### Problema 2 — FKs órfãs
**Migration `20260108014732_*.sql` (companies):**
- Tabela `companies` tem FK pra `company_contacts` que **NÃO existe** no banco atual
- **Plano:** investigar se `company_contacts` também tem migration no repo; se sim, aplicar ANTES de `companies`. Se não, criar ou marcar FK como `NOT VALID`.

**Migration `20260305220938_*.sql` (product_views, product_components, etc.):**
- FK pra `product_groups` que é **VIEW** no banco atual, não TABLE
- **Plano:** dropar a VIEW antes ou remover essa FK específica (analisar caso a caso)

### Problema 3 — 23 migrations sem `IF NOT EXISTS`
**Plano:** patch automático no início de cada migration:
```sql
-- Adicionado ao header de cada migration corrigida
-- Idempotência forçada via wrapper
```

E em cada `CREATE TABLE` interno, adicionar `IF NOT EXISTS` + `DROP POLICY IF EXISTS` antes de cada `CREATE POLICY`.

---

## 📋 LOTES DE APLICAÇÃO

### 🔴 LOTE 1 — CRÍTICAS (12 tabelas, 6 migrations)
Sem essas, **vendedor não consegue trabalhar**.

| # | Tabela | Migration origem | Patch necessário |
|---|---|---|---|
| 1 | `seller_carts` | `20260304014416_*.sql` | ✏️ Skipar user_onboarding |
| 2 | `seller_cart_items` | `20260304014416_*.sql` | ✏️ Skipar user_onboarding |
| 3 | `expert_conversations` | `20260304014416_*.sql` | ✏️ Skipar user_onboarding |
| 4 | `expert_messages` | `20260304014416_*.sql` | ✏️ Skipar user_onboarding |
| 5 | `cart_templates` | `20260317020422_*.sql` | ✏️ Add IF NOT EXISTS |
| 6 | `companies` | `20260108014732_*.sql` | ⚠️ Resolver FK company_contacts |
| 7 | `kit_variants` | `20260418175315_*.sql` | ✏️ Add IF NOT EXISTS |
| 8 | `kit_collaborators` | `20260418175315_*.sql` | ✏️ Add IF NOT EXISTS |
| 9 | `kit_comments` | `20260418175315_*.sql` | ✏️ Add IF NOT EXISTS |
| 10 | `kit_share_tokens` | `20260322174557_*.sql` | ✏️ Add IF NOT EXISTS |
| 11 | `collection_items` | `20260412182408_*.sql` | ✏️ Skipar collections |
| 12 | `collection_items_trash` | `20260420142509_*.sql` | ✅ Já idempotente |

**Quantidade de migrations únicas no Lote 1: 6**
**Tempo estimado:** 1.5 dias (geração + revisão + Branch dev + produção)

---

### 🟠 LOTE 2 — ALTAS (13 tabelas, 9 migrations)
Features importantes do produto.

| # | Tabela | Migration origem | Patch |
|---|---|---|---|
| 13 | `magic_up_generations` | `20260304014707_*.sql` | ✏️ Add IF NOT EXISTS |
| 14 | `magic_up_brand_kits` | `20260420185009_*.sql` | ✅ Já idempotente |
| 15 | `magic_up_campaigns` | `20260420185009_*.sql` | ✅ Já idempotente |
| 16 | `mockup_drafts` | `20260304014707_*.sql` | ✏️ Add IF NOT EXISTS |
| 17 | `mockup_prompt_configs` | `20260416200125_*.sql` | ✅ Já idempotente |
| 18 | `mockup_prompt_history` | `20260416200125_*.sql` | ✅ Já idempotente |
| 19 | `user_preferences` | `20260420172157_*.sql` | ✅ Já idempotente |
| 20 | `user_comparisons` | `20260420164558_*.sql` | ✅ Já idempotente |
| 21 | `favorite_item_reactions` | `20260420130407_*.sql` | ✅ Já idempotente |
| 22 | `product_views` | `20260305220938_*.sql` | ⚠️ Skipar order_items + FK product_groups |
| 23 | `search_analytics` | `20260416231122_*.sql` | ✅ Já idempotente |
| 24 | `saved_trends_views` | `20260416232134_*.sql` | ✏️ Add IF NOT EXISTS |
| 25 | `voice_command_logs` | `20260405151750_*.sql` | ✏️ Add IF NOT EXISTS |

**Quantidade de migrations únicas no Lote 2: 9**
**Tempo estimado:** 1 dia

---

### 🟡 LOTE 3 — MÉDIAS (20 tabelas, 14 migrations)
Admin, config, features secundárias. Detalhes no arquivo `classification.txt`.

**Tempo estimado:** 1 dia

---

### 🟢 LOTE 4 — BAIXAS (20 tabelas, 16 migrations)
Logs, telemetria, segurança. Detalhes no arquivo `classification.txt`.

**Tempo estimado:** 0.5 dia

---

## 🛡️ PROTOCOLO DE SEGURANÇA (REGRAS INVIOLÁVEIS)

Pra cada migration corrigida vai seguir EXATAMENTE este fluxo:

### 1. Geração
- Gero o arquivo `recovery_<tabela>_v1.sql` em pasta separada
- Header padronizado com:
  - O que faz
  - Por que foi necessária correção
  - Diff vs. migration original
  - Idempotência garantida (IF NOT EXISTS em tudo)

### 2. Revisão (sua)
- Você lê o SQL
- Aprova ou pede ajuste

### 3. Teste em Branch dev
- Crio Supabase Branch (sandbox 100% isolado de produção)
- Aplico a migration lá
- Rodo smoke test (verifica se tabela foi criada, RLS funcionando, etc.)
- Resultado vira PR comentário

### 4. Aprovação pra produção (sua)
- Você revisa o resultado do Branch dev
- Aprova explicitamente

### 5. Aplicação em produção
- Apenas com seu OK
- Em transação atômica (rollback automático se falhar)
- Snapshot do Sentry antes/depois

### 6. Validação pós-aplicação
- Confirma tabela existe
- Roda smoke test contra produção
- Marca como ✅ no checklist

### 7. Em caso de erro
- **STOP** imediato no lote
- Documento de incident report
- Discussão antes de continuar

---

## 🚦 FASE 2 — PREPARAÇÃO (próximo passo)

**O que vou fazer:**
1. Criar branch `recovery/phase-2-preparation` no repo
2. Criar pasta `supabase/migrations/_recovery/` com:
   - 45 arquivos `.sql` corrigidos
   - 1 arquivo `README.md` explicando cada um
   - 1 arquivo `apply_order.txt` com ordem de aplicação (respeitando FKs)
3. Cada arquivo será revisável separadamente
4. Quando estiver pronto, abro **1 PR único** com tudo
5. Você revisa, eu ajusto se necessário, só depois passamos pra Fase 3

**Tempo estimado:** 1.5 dias de trabalho meu

---

## 📈 CRONOGRAMA GERAL ESTIMADO

| Fase | Atividade | Duração | Risco |
|---|---|---|---|
| 1 ✅ | Análise (DONE) | 1 dia | Nulo |
| 2 🔄 | Preparação migrations | 1.5 dias | Baixo |
| 3 ⏳ | Validação Branch dev | 1 dia | Baixo |
| 4 ⏳ | Aplicação Lote 1 (críticas) | 0.5 dia | Médio |
| 4 ⏳ | Aplicação Lote 2 (altas) | 0.5 dia | Médio |
| 4 ⏳ | Aplicação Lote 3 (médias) | 0.5 dia | Baixo |
| 4 ⏳ | Aplicação Lote 4 (baixas) | 0.5 dia | Baixo |
| 5 ⏳ | Limpeza pós-recovery | 0.5 dia | Baixíssimo |
| 6 ⏳ | Validação funcional | 0.5 dia | - |
| **TOTAL** | | **~7 dias** | - |

---

## 🆘 KILL SWITCH

A qualquer momento você pode mandar:
- **"PARA"** → eu paro tudo, salvo o estado, espero
- **"REVERTE"** → eu reverto o último merge
- **"PULA LOTE X"** → ignora um lote inteiro
- **"REVISA TUDO DE NOVO"** → eu re-investigado e te devolvo plano novo

---

## 📁 ARTEFATOS GERADOS (estão em /tmp/recovery/ na VPS)

| Arquivo | O que contém |
|---|---|
| `all_missing.txt` | Lista das 65 tabelas faltantes |
| `canonical_unique.txt` | Lista das 45 migrations canônicas |
| `tables_created.txt` | Mapa migration → tabelas que cria |
| `conflicts.txt` | 10 tabelas conflitantes |
| `classification.txt` | Classificação por lote/criticidade |
| `RECOVERY_PLAN.md` | Este documento |

