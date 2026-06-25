# 🎁 Promo Brindes — Plataforma de Vendas de Brindes Promocionais

> Sistema completo de catálogo, orçamentos, simulação de preços e inteligência comercial para vendedores de brindes promocionais.

[![Stack](https://img.shields.io/badge/Stack-React%2018%20%2B%20TypeScript%205%20%2B%20Supabase-blue)]()
[![Build](https://img.shields.io/badge/Build-Vite%205-purple)]()
[![Design](https://img.shields.io/badge/UI-Tailwind%20CSS%20%2B%20shadcn%2Fui-cyan)]()
[![Stock Rupture E2E](https://github.com/promo-gifts/promo-gifts-v4/actions/workflows/stock-rupture-horizon-e2e.yml/badge.svg)](https://github.com/promo-gifts/promo-gifts-v4/actions/workflows/stock-rupture-horizon-e2e.yml)

> 📊 **Último relatório E2E (Risco de Ruptura):** abra a execução mais recente em [Actions → stock-rupture-horizon-e2e](https://github.com/promo-gifts/promo-gifts-v4/actions/workflows/stock-rupture-horizon-e2e.yml) e baixe o artefato `playwright-report-stock-rupture-horizon-*`.

---

## 📋 Sumário

- [Visão Geral](#-visão-geral)
- [Stack Tecnológico](#-stack-tecnológico)
- [Arquitetura](#-arquitetura)
- [Setup Local](#-setup-local)
- [Estrutura de Pastas](#-estrutura-de-pastas)
- [Módulos Principais](#-módulos-principais)
- [Autenticação e Autorização](#-autenticação-e-autorização)
- [Banco de Dados](#-banco-de-dados)
- [Edge Functions](#-edge-functions)
- [Integrações](#-integrações)
- [Convenções de Código](#-convenções-de-código)
- [Deploy](#-deploy)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Visão Geral

**Promo Brindes** é uma plataforma B2B para vendedores de brindes promocionais que integra:

- **Catálogo** com 6.100+ produtos, filtros avançados e infinite scroll virtualizado
- **Simulador de Preços** com cálculo de personalização (gravação, serigrafia, etc.)
- **Criador de Orçamentos** com versionamento e aprovação do cliente
- **Flow — Assistente IA** para recomendação de produtos e propostas comerciais
- **Montador de Kits** com preview visual e exportação PDF
- **Gerador de Mockups** com IA generativa
- **Dashboard BI** com métricas de vendas e análise de tendências
- **Agente de Voz** com reconhecimento por fala e TTS

---

## 🛠 Stack Tecnológico

| Camada | Tecnologia |
|---|---|
| **Frontend** | React 18, TypeScript 5 (strict mode), Vite 5 |
| **Estilização** | Tailwind CSS 3, shadcn/ui, Framer Motion |
| **Estado** | TanStack Query (server state), Zustand (client state) |
| **Backend** | Supabase (Auth, DB, Storage, Edge Functions) |
| **Banco Externo** | PostgreSQL via Edge Function bridge (Promobrind) |
| **IA** | Lovable AI Gateway (Gemini, GPT-5) |
| **Integrações** | Bitrix24 CRM, n8n automações, ElevenLabs TTS |
| **Testes** | Vitest, Testing Library |

---

## 🏗 Arquitetura

```
┌─────────────────────────────────────────────────┐
│                   Frontend (SPA)                 │
│  React 18 + TypeScript + TanStack Query          │
├─────────────────────────────────────────────────┤
│              Supabase Edge Functions             │
│  expert-chat │ external-db-bridge │ mockup-gen   │
├──────────┬──────────┬───────────────────────────┤
│ Supabase │ External │ Integrações               │
│ Database │ DB (PG)  │ Bitrix24 · n8n · ElevenLabs│
└──────────┴──────────┴───────────────────────────┘
```

### Padrões Arquiteturais

- **Feature-based** — código organizado por funcionalidade, não por tipo
- **Hooks como camada de lógica** — separação clara entre UI e lógica de negócio
- **Edge Functions como BFF** — backend leve para integrações e AI
- **Schema-first** — tipos gerados automaticamente do banco (`supabase gen types`)

---

## 🚀 Setup Local

### Pré-requisitos

- **Node.js 20+** (testado em 22.x)
- **npm 10+** (gerenciador oficial deste projeto)
- Conta no **Supabase** (3 projetos: principal, externo de catálogo e CRM)
- Acesso ao repositório e às chaves dos serviços externos (CNPJá, etc.)

### 1. Clonar e instalar

```bash
git clone <repo-url>
cd promo-brindes
npm install
```

### 2. Configurar Supabase

Esta aplicação consome **3 instâncias Supabase** distintas:

| Instância | Para quê |
|---|---|
| **Principal** (`SUPABASE_*`) | Auth, RLS, edge functions, tabelas de orçamento/usuários |
| **Externa** (`EXTERNAL_SUPABASE_*`) | Catálogo de produtos (SSOT — somente leitura no app) |
| **CRM** (`CRM_SUPABASE_*`) | Bridge com base de clientes (Bitrix/SalesPro) |

Para cada projeto Supabase você precisa de:

1. Criar/abrir o projeto em [supabase.com](https://supabase.com).
2. Em **Project Settings → API**, copiar:
   - **Project URL** → vira `*_SUPABASE_URL`
   - **anon public key** → vira `*_SUPABASE_ANON_KEY`
   - **service_role key** → vira `*_SUPABASE_SERVICE_ROLE_KEY` / `*_SUPABASE_SERVICE_KEY`
3. Aplicar as migrações em `supabase/migrations/` **em projeto Supabase novo/vazio** (uso típico de dev local):
   ```bash
   npx supabase link --project-ref <seu-project-ref>
   npx supabase migration up
   ```
   > ⚠️ **Nunca rode comandos destrutivos de sincronização de schema contra o banco de produção.** O repo tem 332 migrations vs 209 aplicadas no banco — divergência histórica. Para qualquer mudança no banco principal, ver [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
4. Deployar as edge functions (opcional em dev — feito via CI):
   ```bash
   npx supabase functions deploy --project-ref <seu-project-ref>
   ```

> ⚠️ Nunca commite a `service_role key`. Ela só vive em segredos do servidor (Lovable / GitHub Actions / Vercel).

### 3. Variáveis de ambiente

Crie um arquivo **`.env.local`** na raiz (ele já está no `.gitignore`):

```bash
# --- Supabase principal (frontend) ---
VITE_SUPABASE_URL="https://<ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon-key>"
VITE_SUPABASE_PROJECT_ID="<project-ref>"

# --- Supabase externo (catálogo) — frontend ---
VITE_EXTERNAL_SUPABASE_URL="https://<ref-externo>.supabase.co"
VITE_EXTERNAL_SUPABASE_ANON_KEY="<anon-key-externo>"

# --- CRM (frontend, opcional para dev) ---
VITE_CRM_SUPABASE_URL="https://<ref-crm>.supabase.co"
VITE_CRM_SUPABASE_ANON_KEY="<anon-key-crm>"
```

**Segredos server-side** (edge functions) — configure no painel **Supabase → Edge Functions → Secrets** do projeto principal, **não** no `.env.local`:

| Secret | Origem |
|---|---|
| `SUPABASE_URL` | URL do Supabase principal |
| `SUPABASE_ANON_KEY` | anon key principal |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role principal (injetado automaticamente) |
| `EXTERNAL_SUPABASE_URL` | URL do projeto de catálogo |
| `EXTERNAL_SUPABASE_ANON_KEY` | anon key catálogo |
| `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` | service_role catálogo |
| `EXTERNAL_SUPABASE_SERVICE_KEY` | alias da service key (compatibilidade) |
| `CRM_SUPABASE_URL` | URL do CRM |
| `CRM_SUPABASE_ANON_KEY` | anon key CRM |
| `CRM_SUPABASE_SERVICE_KEY` | service_role do CRM |
| `CNPJA_API_KEY` | painel [cnpja.com](https://cnpja.com) → API Keys |
| `LOVABLE_API_KEY` | gerada pelo Lovable AI Gateway (rotacionável) |

Para definir via CLI:

```bash
npx supabase secrets set EXTERNAL_SUPABASE_URL="https://..." \
  CNPJA_API_KEY="..." --project-ref <ref>
```

### 4. Rodar em desenvolvimento

```bash
npm run dev          # http://localhost:8080
npm run test         # Vitest
npm run build        # build de produção
```

### Comandos disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (porta 8080) |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |
| `npm run test` | Executa testes Vitest |
| `npm run test:coverage` | Testes com cobertura |
| `npm run lint` | **Gate** de baseline TS (não roda ESLint — ver nota abaixo) |
| `npm run lint:baseline` | Gate ESLint baseline (bloqueia apenas regressões novas) |
| `npm run qa:lint` | ESLint real (todas as violações, ignora baseline) |
| `npm run typecheck` | **Gate** de baseline TS (alias de `lint`) |
| `npm run qa:typecheck` | `tsc -p tsconfig.app.json --noEmit` real (todas as violações) |
| `npm run qa:full` | Roda os 3 gates QA reais em sequência |
| `npm run test:e2e` | Suíte E2E Playwright |

> ⚠️ **Nota sobre `lint` e `typecheck`** — Em alinhamento com o gate-de-baseline adotado pelo time, `npm run lint` e `npm run typecheck` executam **apenas o gate de regressão** sobre `.tsc-baseline.json` (bloqueiam apenas erros novos). Para inspeção completa (sem o filtro de baseline), use `npm run qa:lint` (ESLint real) e `npm run qa:typecheck` (tsc real). Ver `docs/QA_REPORT_2026-05-22.md` para histórico.

### Solução de problemas

- **`Failed to fetch` em edge function** → verifique se o secret `*_SUPABASE_URL` correspondente está setado no projeto certo.
- **`401 Unauthorized` no catálogo** → confirme `VITE_EXTERNAL_SUPABASE_ANON_KEY` no `.env.local`.
- **Login não funciona** → no painel Supabase principal, em **Authentication → URL Configuration**, adicione `http://localhost:8080` em *Site URL* e *Redirect URLs*.

---

## 📁 Estrutura de Pastas

```
src/
├── assets/           # Imagens e assets estáticos
├── components/       # Componentes React organizados por feature
│   ├── admin/        # Painel administrativo (produtos, BI, cadastros)
│   ├── catalog/      # Catálogo de produtos (grid, lista, tabela)
│   ├── compare/      # Comparador de produtos
│   ├── errors/       # Error boundaries (global + rota)
│   ├── expert/       # Flow — Assistente IA (chat, filtros)
│   │   └── chat/     # Componentes do chat (Header, MessageList, InputBar)
│   ├── filters/      # Sistema de filtros avançados
│   ├── kit-builder/  # Montador de kits customizados
│   ├── layout/       # Layout principal, sidebar, header
│   ├── mockup/       # Gerador de mockups com IA
│   ├── orders/       # Gestão de pedidos
│   ├── products/     # Cards, quick view, detalhes de produto
│   ├── quotes/       # Criador de orçamentos + aprovação
│   ├── search/       # Busca global (Command Palette)
│   ├── seo/          # Meta tags e SEO
│   ├── simulator/    # Simulador de preços de personalização
│   ├── ui/           # Componentes base (shadcn/ui)
│   └── voice/        # Agente de voz (orb, overlay)
├── contexts/         # React Contexts (Auth, etc.)
├── hooks/            # Custom hooks (dados, filtros, estado)
├── integrations/     # Supabase client e tipos (auto-gerados)
├── lib/              # Utilitários, serviços, helpers
│   ├── external-db/  # Bridge para banco externo
│   ├── logger.ts     # Logger estruturado
│   └── personalization/ # Engine de cálculo de personalização
├── pages/            # Páginas/rotas da aplicação
├── stores/           # Zustand stores
└── types/            # Tipos TypeScript globais

supabase/
├── config.toml       # Configuração do projeto Supabase
├── functions/        # 81 Edge Functions (Deno) — ver docs/EDGE_FUNCTIONS.md
│   ├── _shared/      # Utilitários compartilhados (CORS, auth, validação)
│   ├── expert-chat/  # Assistente IA
│   ├── external-db-bridge/ # Bridge para banco externo
│   └── ...
└── migrations/       # 710 arquivos SQL versionados (~685 aplicadas em PROD)
```

---

## 📦 Módulos Principais

### 1. Catálogo (`/` e `/filtros`)
- Grid virtualizado com 20k+ itens renderizados eficientemente
- 3 layouts: Grade, Lista, Tabela — com paridade funcional total
- Filtros: categoria, material, cor, preço, fornecedor, técnica, público-alvo
- Seleção em lote para comparação e orçamentos
- Deep linking completo (gênero, tamanhos, cores, views)

### 2. Simulador de Preços (`/simulador`)
- Wizard de 4 etapas: Local → Grupo → Variação → Configuração
- Cálculo de personalização com faixas de quantidade
- Comparação visual entre técnicas e fornecedores
- Persistência de rascunhos no banco

### 3. Criador de Orçamentos (`/orcamentos/novo`)
- Stepper animado de 6 etapas com micro-interações
- Versionamento de orçamentos com histórico completo
- Aprovação do cliente via link público com token único
- Exportação PDF profissional

### 4. Flow — Assistente IA
- Chat com streaming (SSE) e Markdown renderizado
- Filtros de produto integrados ao contexto da conversa
- Modo CRM: análise de cliente, propostas personalizadas
- TTS (Text-to-Speech) e entrada por voz
- Histórico de conversas com busca e filtro por data

### 5. Montador de Kits (`/montar-kit`)
- Drag-and-drop de produtos
- Preview visual do kit com cálculo de volume
- Estimativa de frete (SEDEX/PAC)
- Compartilhamento via link público

### 6. Dashboard BI (`/bi`)
- Métricas de vendas em tempo real (Recharts)
- Análise de tendências e sazonalidade
- Top produtos, categorias e fornecedores
- Exportação de relatórios

---

## 🔐 Autenticação e Autorização

### Auth
- Supabase Auth com email/senha e verificação obrigatória
- Google OAuth como login social
- Refresh automático de tokens via `AuthContext`
- Sign-up desativado (plataforma fechada/convite)
- Proteção HIBP e restrição por IP/Geolocalização

### RBAC
- 3 papéis: `admin`, `manager`, `vendedor`
- Tabela `user_roles` com enum `app_role`
- Função `has_role()` (SECURITY DEFINER) para queries sem recursão RLS
- Tabela `role_permissions` para permissões granulares
- `AdminRoute` wrapper para proteção de rotas sensíveis

### RLS
- **100% das tabelas** têm Row Level Security ativado
- Policies baseadas em `auth.uid()` e `has_role()`
- Multi-tenancy via `organization_id` com isolamento completo

---

## 🗄 Banco de Dados

### Supabase (Interno)
- **269 tabelas** em `public`, **100% com RLS ativo** (662 policies, ~2.5 por tabela)
- **112 funções `SECURITY DEFINER`**, 100% com `search_path` setado (gate de CI bloqueia regressão)
- **~710 migrations** versionadas (~685 aplicadas em PROD; drift de ~25)
- Tipos gerados automaticamente (`supabase gen types`)
- Connection pooling via Supabase pooler
- 17 cron jobs ativos via `pg_cron` (autenticados por secret no vault)

### Banco Externo (Promobrind)
- Acesso via Edge Function `external-db-bridge`
- Cache em memória com TTL de 10 minutos
- Fallback progressivo para resiliência
- Retry com backoff exponencial

---

## ⚡ Edge Functions

**81 Edge Functions** (Deno) organizadas em categorias. **24 marcadas `verify_jwt = false`** em `supabase/config.toml` — todas com defesa interna validada (vault secret, `x-mcp-key`, `x-dispatcher-secret`, `runBotProtection`, ou `authenticateRequest`). Para inventário completo veja [`docs/EDGE_FUNCTIONS.md`](docs/EDGE_FUNCTIONS.md).

| Categoria | Funções |
|---|---|
| **IA** | `expert-chat`, `generate-ad-image`, `generate-mockup-*` |
| **Dados** | `external-db-bridge`, `fetch-product-details` |
| **Auth** | `verify-email`, `rate-limit-check` |
| **Integrações** | `bitrix-*`, `webhook-dispatcher` |
| **Utilitários** | `generate-pdf`, `send-email`, `tts-*` |

### Padrões
- CORS com allowlist restritiva (`_shared/cors.ts`)
- Autenticação via JWT (`authenticateRequest()`)
- Validação de input com Zod (`_shared/validate.ts`)
- Error handling estruturado com try/catch

---

## 🔌 Integrações

| Sistema | Uso | Protocolo |
|---|---|---|
| **Bitrix24** | CRM, contatos, deals | REST API + OAuth2 |
| **n8n** | Automações (webhooks, emails) | Webhooks |
| **ElevenLabs** | Text-to-Speech no Agente de Voz | WebSocket |
| **Lovable AI** | Chat IA, geração de imagens | API Gateway |

---

## 📝 Convenções de Código

### TypeScript
- `strict: true` no tsconfig
- Zero `any` (exceto em type guards justificados)
- Return types explícitos em funções públicas
- Validação runtime com Zod nas Edge Functions

### Componentes
- `forwardRef` obrigatório em componentes de UI reutilizáveis
- Hooks como camada de lógica (não lógica em JSX)
- Máximo ~200 linhas por arquivo (extrair sub-componentes)
- Semantic tokens do design system (nunca cores hardcoded)

### Logging
- `logger.info/warn/error` (nunca `console.log` em produção)
- Logs estruturados com contexto

---

## 🚢 Deploy

O deploy é gerenciado automaticamente pelo **Lovable Cloud**:

1. Push para a branch principal
2. Build automático via Vite
3. Edge Functions deployadas automaticamente
4. Preview disponível em URL única

### URLs
- **Preview**: `https://id-preview--*.lovable.app`
- **Produção**: `https://criar-together-now.lovable.app`

---

## 🔧 Troubleshooting

| Problema | Causa | Solução |
|---|---|---|
| "Failed to fetch dynamically imported module" | Cache do browser com chunks antigos | `EnhancedErrorBoundary` faz auto-recovery. Se persistir, Ctrl+Shift+R |
| Produtos não carregam | Limite de 1000 rows ou timeout do banco externo | Verificar paginação e status do `external-db-bridge` |
| "new row violates row-level security" | Usuário não autenticado ou sem permissão | Verificar token JWT e policies RLS |
| Edge Function timeout | Queries pesadas ou API externa lenta | Verificar logs da função |
| Tela branca após deploy | Chunk loading error | Limpar cache do navegador e recarregar |

---

## 📊 Métricas do Projeto

| Métrica | Valor (snapshot 2026-05-22) |
|---|---|
| Arquivos TypeScript | 1.736 |
| Edge Functions | 82 |
| Migrations SQL | 708 |
| Workflows GitHub Actions | 11 |
| Tabelas com RLS | 100% |
| Testes Vitest (arquivos) | 349 |
| Specs Playwright | 155 |
| TypeScript strict | ✅ |
| ESLint baseline (errors suprimidos) | 472 |
| TS baseline (errors suprimidos) | 1.375 |

> Snapshot mais recente, com baselines pós-rodada QA. Para detalhes do estado QA atual ver [`docs/QA_REPORT_2026-05-22.md`](docs/QA_REPORT_2026-05-22.md).

---

## 🛒 E2E dos Carrinhos (Playwright)

Os specs do popover do carrinho ativo ficam em `e2e/carrinhos/` e rodam no
projeto `chromium-smoke`.

### Comandos npm

| Comando | O que faz |
| --- | --- |
| `npm run test:e2e:carrinhos` | Roda toda a suíte `e2e/carrinhos/*.spec.ts` localmente. |
| `npm run test:e2e:carrinhos:update` | Atualiza os baselines visuais (`--update-snapshots`). Commitar os PNGs gerados em `e2e/carrinhos/**-snapshots/`. |
| `npx playwright show-report` | Abre o relatório HTML da última execução local. |

Fluxo recomendado ao mexer no popover do carrinho:

1. Ajuste o componente.
2. Rode `npm run test:e2e:carrinhos`.
3. Se diffs visuais forem intencionais, rode `npm run test:e2e:carrinhos:update`
   e versione os snapshots no commit (`git add e2e/carrinhos/**-snapshots/`).

### Interpretando artefatos do CI

O workflow `.github/workflows/playwright.yml` publica dois artefatos:

- **`playwright-report`** (sempre): relatório HTML completo. Baixe, extraia e
  abra `index.html` (ou rode `npx playwright show-report <pasta>`).
- **`playwright-failure-bundle`** (só em falha): inclui o report HTML +
  `trace.zip`, screenshots `only-on-failure` e vídeos `retain-on-failure`.

Para diagnosticar uma falha:

1. Baixe `playwright-failure-bundle` na aba **Actions → Run → Artifacts**.
2. Inspecione o `trace.zip` com `npx playwright show-trace path/para/trace.zip`
   — mostra DOM, console, network e screenshot por step.
3. Cruze com o `*.png` (estado final) e o `*.webm` (gravação da execução).

CI usa `--retries=2 --workers=2`: testes que passam após retry aparecem como
"flaky" no report; falhas em todas as tentativas continuam vermelhas.

---

## 📜 Licença

Projeto proprietário — todos os direitos reservados.

---

**Desenvolvido por Pink e Cerébro × Promo Brindes** 🚀


---

## 🧪 Playwright — Snapshots visuais (quote-number-subtitle)

O spec `e2e/quotes/quote-number-subtitle.spec.ts` valida que o subtítulo do
`quote_number` substitui a frase legada **"Crie um orçamento com produtos e
personalizações"** no header de `/orcamentos/novo` em todos os breakpoints
suportados.

### Breakpoints cobertos

| Nome     | Width × Height | Baseline PNG                                     |
| -------- | -------------- | ------------------------------------------------ |
| mobile   | 390 × 844      | `quote-number-subtitle-mobile.png`               |
| tablet   | 768 × 1024     | `quote-number-subtitle-tablet.png`               |
| desktop  | 1280 × 800     | `quote-number-subtitle-desktop.png`              |
| wide     | 1920 × 1080    | `quote-number-subtitle-wide.png`                 |

Todas as baselines vivem em
`e2e/quotes/quote-number-subtitle.spec.ts-snapshots/` e são versionadas no
repo (NUNCA editar à mão).

### Rodar localmente

```bash
# 1) Instalar Chromium pinned do Playwright
npm run test:e2e:install

# 2) Validar contra as baselines existentes (modo PR — falha em regressão)
npx playwright test e2e/quotes/quote-number-subtitle.spec.ts \
  --project=chromium-authed

# 3) Regenerar baselines (APENAS em mudança visual intencional)
npx playwright test e2e/quotes/quote-number-subtitle.spec.ts \
  --project=chromium-authed --update-snapshots

# 4) Debug headed com trace
npx playwright test e2e/quotes/quote-number-subtitle.spec.ts \
  --project=chromium-authed --headed --trace=on
```

### Regenerar baselines via GitHub Actions

Workflow manual: **`Update Quote Visual Snapshots`**
(`.github/workflows/update-quote-reset-snapshots.yml`) — rode em
`Actions → Run workflow`. Ele executa com `--update-snapshots`, commita os
PNGs novos no branch escolhido e cobre tanto `quote-reset-stepper-layout`
quanto `quote-number-subtitle`.

### CI de PR

O job **`E2E Subtítulo quote_number (visual)`** em
`ci-quotes-wizard.yml` roda automaticamente em PRs que tocam `src/pages/quotes/**`,
`src/hooks/quotes/**`, `src/components/quotes/**` ou `e2e/quotes/**`,
sempre **sem** `--update-snapshots` — falha em qualquer regressão visual e
publica os diffs (`*-actual.png`, `*-expected.png`, `*-diff.png`) como
artifact `quote-number-subtitle-failure-bundle`.
