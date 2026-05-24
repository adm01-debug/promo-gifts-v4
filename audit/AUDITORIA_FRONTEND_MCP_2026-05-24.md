# Auditoria de Front-end via MCP — promo-gifts-v4

**Data:** 2026-05-24
**Alvo:** https://www.promogifts.com.br/ (produção · Vercel)
**Backend:** Supabase `doufsxqlfjyuvxuezpln`
**Sessão:** login `adm01@promobrindes.com.br` — papel **Supervisor** (usuário "Joaquim Ataides")
**Método:** navegador remoto via MCP (sessão persistente), captura de rede, snapshots ARIA, screenshots + análise de código-fonte + advisors do Supabase.

---

## Resumo executivo

| # | Severidade | Achado | Status |
|---|------------|--------|--------|
| 1 | **Alta** | Texto corrompido (mojibake UTF-8 duplo) em ~22 arquivos / 500 ocorrências, visível em login, simulador de preços, Kit Maker, formulários admin | ✅ **Corrigido neste PR** |
| 2 | **Alta** | 17 funções `SECURITY DEFINER` executáveis por `anon`/`authenticated` (ex.: `get_quote_token_by_value`, `cleanup_expired_webhook_request_nonces` por **anon**) | ⚠️ Documentado — requer revisão |
| 3 | **Média/Alta** | 373 tabelas expostas ao papel `anon` via API (inclui `admin_audit_log`, `admin_settings`, `access_security_settings`, `auth_login_attempts`) | ⚠️ Verificar RLS |
| 4 | **Média** | Política RLS "sempre verdadeira" em `password_reset_requests` (INSERT, role público) | ⚠️ Validar rate-limit |
| 5 | **Média** | Kit Maker (`/montar-kit`) renderiza dados de **mock** (`src/lib/kit-builder/mock-data.ts`) em produção | ⚠️ Documentado |
| 6 | **Média** | **Todos** os produtos do catálogo exibem o aviso "Preço próximo do limite de validade" | ⚠️ Investigar threshold/dados |
| 7 | **Baixa** | Widget de calendário do Dashboard preso em skeleton (loading infinito aparente) | ⚠️ Documentado |
| 8 | Info | Área `/admin/*` exige cadastro de MFA — não auditada em profundidade (não habilitamos MFA na conta do usuário) | — |

> Itens 1 e a varredura de rede foram a parte executável; os demais são achados de auditoria com recomendação. Dívida técnica já rastreada (1.010 erros TS no baseline, 442 ESLint) **não** é recontada aqui.

---

## 1. Mojibake UTF-8 (CORRIGIDO) — Severidade Alta

### Evidência
Strings com dupla codificação UTF-8 → Latin-1 → UTF-8 apareciam renderizadas no site:

- **Login** (`/auth`): *"Entre com suas credenciais para Brilhar, **vocÃª** nasce para isso!"* e *"VerificaÃ§Ã£o em tempo real das instÃ¢ncias Supabase"*.
- **Kit Maker** (`/montar-kit`): dimensões *"15Ã— 10 Ã— 8 cm"* (× corrompido) e material *"PapelÃ£o Revestido"*.
- **Simulador de preços** / personalização: mensagens de validação *"Quantidade mÃ­nima Ã© ... unidades"*, *"NÃºmero de cores excede mÃ¡ximo"*, *"Ãrea de gravaÃ§Ã£o"*.
- Formulários admin (componentes de kit, fornecedores, importação em massa).

### Causa-raiz
Arquivos salvos com bytes duplo-codificados (ex.: `você` gravado como bytes `C3 83 C2 AA`). Confirmado em `src/pages/auth/Auth.tsx:604`. Atingia **22 arquivos** — incluindo lógica de domínio (`src/lib/personalization/*`, `src/lib/kit-builder/*`).

> Verificado que **não** havia mojibake dentro de comparações (`===`, `includes()`, `case`) — ou seja, era corrupção de **exibição/comentário**, sem quebra lógica. Severidade alta por impacto de UX/profissionalismo em telas centrais.

### Correção aplicada
Reversão seletiva por runs de bytes Latin-1 que formam UTF-8 válido (preserva caracteres legítimos). **500 ocorrências corrigidas em 22 arquivos**, 0 mojibake restante. Diff balanceado (329/329), apenas conteúdo de strings/comentários — sem mudança estrutural de código.

Arquivos: `auth/Auth.tsx`, `lib/personalization/{validators,selectors,calculators,transformers}.ts`, `lib/kit-builder/{mock-data,price-calculator,volume-calculator}.ts`, `components/pricing/**`, `components/admin/products/**`, `components/admin/suppliers-manager/SupplierTable.tsx`, `hooks/voice/processTranscript.ts`.

---

## 2–4. Backend Supabase — Advisors de segurança

`get_advisors(security)` retornou **783 avisos (WARN)**:

| Avisos | Tipo | Risco |
|--------|------|-------|
| 392 | `pg_graphql_authenticated_table_exposed` | tabelas expostas a usuários autenticados via API |
| 373 | `pg_graphql_anon_table_exposed` | **tabelas expostas ao papel `anon` (não autenticado)** |
| 12 | `authenticated_security_definer_function_executable` | funções `SECURITY DEFINER` chamáveis por autenticados |
| 5 | `anon_security_definer_function_executable` | **funções `SECURITY DEFINER` chamáveis por `anon`** |
| 1 | `rls_policy_always_true` | política RLS sem restrição |

### 2. Funções `SECURITY DEFINER` executáveis por anon (revisar)
`SECURITY DEFINER` roda com privilégios do owner. Expostas a **anon**: `check_login_rate_limit`, `cleanup_expired_webhook_request_nonces`, `get_public_schema_signatures`, `get_quote_token_by_value`, `submit_quote_response`.
- `get_quote_token_by_value` por anon → risco de **enumeração de tokens** de orçamento.
- `cleanup_expired_webhook_request_nonces` por anon → função de manutenção não deveria ser pública.
- `get_public_schema_signatures` por anon → possível vazamento de estrutura de schema.

### 3. 373 tabelas expostas ao papel `anon`
Inclui tabelas sensíveis: `admin_audit_log`, `admin_settings`, `access_security_settings`, `auth_login_attempts`, `audit_logs`, `ai_usage_logs`, `analytics_events`, `api_usage`. **Exposição via API ≠ leitura permitida** (depende de RLS), mas a quantidade e a natureza (auditoria/segurança/admin) exigem verificação de que há RLS restritiva ativa em cada uma.

### 4. RLS sempre-verdadeira — `password_reset_requests`
Política `"Anyone can request a password reset"` (INSERT, `WITH CHECK true`, role público). Provavelmente **intencional** (qualquer um precisa solicitar reset antes de logar), porém deve ser protegida por **rate-limit/captcha** para evitar abuso/flood.

> Remediação: https://supabase.com/docs/guides/database/database-linter

---

## 5. Kit Maker servindo dados de mock em produção — Média

As caixas exibidas em `/montar-kit` (Caixa Kraft P/M/G, Caixa Premium Preta M, com materiais "Papelão Revestido", "Cerâmica", "Aço Inox") correspondem exatamente a `src/lib/kit-builder/mock-data.ts`. Indica que o catálogo de embalagens do Kit Maker **não está ligado a dados reais** do banco — funcionalidade aparentemente incompleta/placeholder.

## 6. Aviso de validade de preço em todos os produtos — Média
Em `/` e `/produtos`, **todos** os cards exibem o status *"Preço próximo do limite de validade"*. Ou os preços estão genuinamente desatualizados em massa, ou o threshold de "price freshness" está mal calibrado (gera ruído e mascara produtos realmente desatualizados). Verificar `src/utils/price-freshness.ts` e a data-base dos preços.

## 7. Widget de calendário do Dashboard — Baixa
Em `/dashboard`, o widget abaixo de "Suas Métricas do Mês" permaneceu em skeleton (carregamento aparentemente infinito) durante a sessão. Confirmar se há fetch travado/sem fallback.

---

## Cobertura da auditoria

**Rotas verificadas (render + rede 2xx OK):** `/auth`, `/` (catálogo), `/dashboard`, `/orcamentos`, `/orcamentos/novo`, `/clientes`, `/montar-kit`, `/ferramentas/bi`, `/busca-preco`, `/produtos`. Login e carregamento inicial: todas as chamadas a `doufsxqlfjyuvxuezpln.supabase.co` retornaram 200/201/204 (sem 4xx/5xx).

**Não auditado em profundidade (honestidade de escopo):**
- **`/admin/*`** — bloqueado por modal obrigatório de cadastro de MFA ("contas com acesso administrativo precisam ter MFA ativado"). Não habilitamos MFA na conta do usuário.
- Interação botão-a-botão exaustiva em cada uma das ~70 rotas — inviável via navegador remoto numa sessão; foi feita varredura em nível de página + fluxos principais (login, navegação, builder de orçamento).
- Rotas dev-only (`DevRoute`) — papel atual é Supervisor, não dev.

**Observação técnica:** o campo de senha (`#login-password`, `type=password`) resistiu a `.fill()` de automação até alternar para `type=text` via "Mostrar senha" — comportamento compatível com proteção anti-bot ou animação de overlay (starfield). Não é bug funcional para usuários reais.

---

## Recomendações priorizadas
1. **Mergear o fix de mojibake** (este PR) e adicionar um guard no CI (`grep -rP "Ã[\\x80-\\xBF]"` em `src/`) para impedir regressão.
2. **Revisar grants das funções `SECURITY DEFINER` expostas a `anon`** — `REVOKE EXECUTE ... FROM anon` nas que não forem fluxo público (especialmente `cleanup_*`, `get_public_schema_signatures`, `get_quote_token_by_value`).
3. **Auditar RLS** das 373 tabelas anon-expostas; priorizar `admin_*`, `*audit*`, `access_security_settings`, `auth_login_attempts`.
4. Adicionar **rate-limit/captcha** ao fluxo de `password_reset_requests`.
5. Ligar o Kit Maker a dados reais (ou marcar claramente como demo).
6. Calibrar o threshold de validade de preço.
7. Executar `get_advisors(performance)` (não rodado nesta sessão) para fechar o lado de performance.
