-- ============================================================
-- MIGRATION: doc_admin_settings_comment_on_table_and_columns
-- Objetivo : Documentar propósito, estado, chaves conhecidas
--            e descrição de cada coluna de admin_settings.
-- Data     : 2026-06-15
-- Branch   : chore/admin-settings-hardening
-- Melhoria : #1 de 4 — COMMENT ON TABLE + COMMENT ON COLUMNS
-- ============================================================

-- ----------------------------------------------------------
-- 1. COMENTÁRIO NA TABELA
-- ----------------------------------------------------------
COMMENT ON TABLE public.admin_settings IS
'Key-value store de configurações globais do painel admin.
Padrão: 1 linha por configuração, chave única, valor em JSONB livre.
Criada em 20260514 (migration t39_create_missing_tables_part3).

PROPÓSITO:
  Persistir preferências e parâmetros configuráveis pelo admin
  que precisam ser compartilhados entre máquinas sem necessidade
  de deploy. Todos os admins leem/escrevem o mesmo valor.

CONSUMIDORES (frontend — src/hooks/admin/):
  useRetestCooldownSetting.ts
    chave: retest_cooldown | valor: { ms: number }
    uso  : cooldown em ms do botão Testar novamente nos cards de
           conexão de fornecedores. Default: 3000. Presets: [3000,10000,30000,60000].

  useIntelligenceBadgeSettings.ts
    chave: intelligence_badges
    valor: { hotItem:{enabled:bool}, bestSeller:{enabled:bool, minAvgDailyDepletion7d:number} }
    uso  : liga/desliga badges Hot Item e Best-seller no ProductCard.
           Default: hotItem enabled=true, bestSeller enabled=true threshold=15.

PADRÃO DE ACESSO (ambos os hooks):
  Leitura : supabase.from(admin_settings).select(value).eq(key,KEY).maybeSingle()
  Gravação: supabase.from(admin_settings).upsert({key,value},{onConflict:key})
  Cache module-level + broadcast pattern — fetch único por sessão por chave.

RLS:
  SELECT/INSERT/UPDATE → authenticated com has_role(uid, admin)
  DELETE               → sem policy (bloqueado implicitamente pelo RLS)
  anon                 → sem GRANT

INFRAESTRUTURA:
  Trigger: update_admin_settings_updated_at → BEFORE UPDATE → update_updated_at_column()
  FK em updated_by: pendente (melhoria #3)
  Nenhuma função Postgres acessa esta tabela — só frontend.
  Nenhuma view depende desta tabela.

ESTADO: 0 linhas (2026-06-15) — admins usando defaults do frontend.
NÃO ARQUIVAR / NÃO DROPAR — tabela ativa com consumidores no frontend.';

-- ----------------------------------------------------------
-- 2. COMENTÁRIOS NAS COLUNAS
-- ----------------------------------------------------------
COMMENT ON COLUMN public.admin_settings.id IS
'PK UUID. Gerado automaticamente (gen_random_uuid()). Chave técnica — não exposta no frontend.';

COMMENT ON COLUMN public.admin_settings.key IS
'Chave identificadora única da configuração (NOT NULL UNIQUE).
Convenção: snake_case, descritivo do domínio.
Chaves registradas (2026-06-15):
  retest_cooldown    → useRetestCooldownSetting.ts
  intelligence_badges → useIntelligenceBadgeSettings.ts
Ao criar nova chave: documentar aqui e no hook correspondente.';

COMMENT ON COLUMN public.admin_settings.value IS
'Payload JSONB da configuração (NOT NULL, default {}).
Schema livre — cada chave define o próprio shape.
Shapes conhecidos:
  retest_cooldown    → { ms: number }
  intelligence_badges → { hotItem:{enabled:bool}, bestSeller:{enabled:bool, minAvgDailyDepletion7d:number} }
Sempre sanitizar/validar no frontend antes de usar (hooks têm função sanitize()).';

COMMENT ON COLUMN public.admin_settings.updated_by IS
'UUID do admin que realizou a última alteração. Nullable.
NULL quando criado pelo sistema ou quando o frontend não envia o campo.
Sem FK formal para auth.users — a adicionar em melhoria #3.
Hooks atuais (useRetestCooldownSetting, useIntelligenceBadgeSettings) não setam este campo.';

COMMENT ON COLUMN public.admin_settings.created_at IS
'Timestamp de criação da linha. Auto-preenchido (DEFAULT now()). Imutável após INSERT.';

COMMENT ON COLUMN public.admin_settings.updated_at IS
'Timestamp da última atualização. Auto-atualizado pelo trigger
update_admin_settings_updated_at (BEFORE UPDATE → update_updated_at_column()).
Igual a created_at enquanto a linha não for alterada após INSERT.';
