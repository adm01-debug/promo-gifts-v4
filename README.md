# 🎁 Promo Brindes — Plataforma de Vendas de Brindes Promocionais

> Sistema completo de catálogo, orçamentos, simulação de preços e inteligência comercial para vendedores de brindes promocionais.

[![Stack](https://img.shields.io/badge/Stack-React%2018%20%2B%20TypeScript%205%20%2B%20Supabase-blue)]()
[![Build](https://img.shields.io/badge/Build-Vite%205-purple)]()
[![Design](https://img.shields.io/badge/UI-Tailwind%20CSS%20%2B%20shadcn%2Fui-cyan)]()

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
3. Aplicar as migrações em `supabase/migrations/` no projeto principal:
   ```bash
   npx supabase link --project-ref <seu-project-ref>
   npx supabase db push
   ```
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
# npm (recomendado — o hook `predev` já roda `clean:vite` automaticamente)
npm run dev          # http://localhost:8080

# pnpm (pnpm v7+ NÃO executa hooks pre*; use o script explícito)
pnpm run dev:pnpm    # = clean:vite + pnpm exec vite

# yarn classic v1 (roda `predev` sozinho)
yarn dev
# yarn berry v2+ (sem pre-hooks): use o script explícito
yarn dev:yarn        # = clean:vite + yarn exec vite
```

### Comandos disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (porta 8080), com `clean:vite` automático via `predev` |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |
| `npm run test` | Executa testes Vitest |
| `npm run test:coverage` | Testes com cobertura |
| `npm run lint:check` | ESLint |
| `npm run test:e2e` | Suíte E2E Playwright |
| `npm run clean:vite` | Remove `node_modules/.vite` e `node_modules/.vite-temp` |
| `npm run dev:clean` | `clean:vite` + `npm install` + `npm run dev` |
| `npm run dev:clean:pnpm` | `clean:vite` + `pnpm install` + `pnpm dev` |
| `npm run dev:clean:yarn` | `clean:vite` + `yarn install` + `yarn dev` |
| `npm run clean:all` | Remove `node_modules` (+ cache Vite), reinstala e sobe o dev |
| `npm run clean:all:hard` | Idem + apaga `package-lock.json`/`bun.lock` antes de reinstalar |

#### Opcional: fazer `pnpm dev` rodar `predev` sozinho

A partir do **pnpm v7**, hooks `pre*`/`post*` ficam desativados por padrão
(`enable-pre-post-scripts=false`), então `pnpm dev` **não** executa `predev`
automaticamente — por isso oferecemos o `pnpm run dev:pnpm` (que já faz o
chaining explícito). Se você quiser o mesmo comportamento do npm/yarn classic
(rodar `predev` antes de `dev`), habilite a flag do pnpm em **um** dos níveis
abaixo:

```bash
# A) Por projeto (recomendado — versionável) — cria/edita .npmrc na raiz
echo "enable-pre-post-scripts=true" >> .npmrc

# B) Por usuário (afeta todos os projetos da sua máquina)
pnpm config set enable-pre-post-scripts true

# C) Pontual, sem persistir (apenas nesta execução)
npm_config_enable_pre_post_scripts=true pnpm dev
```

Depois disso, `pnpm dev` passa a chamar `predev` (= `npm run clean:vite`) antes
de subir o Vite, igual ao npm. Observações:

- A flag liga **todos** os hooks `pre*`/`post*` do `package.json` — confira se
  não há nenhum que você não queira executar.
- Ela controla apenas hooks com o prefixo padrão (`predev`, `postbuild`, etc.).
  Scripts customizados como `predev:pnpm` continuam só sendo executados quando
  chamados explicitamente (ex.: `pnpm run dev:pnpm`).
- Para desligar de novo: `pnpm config set enable-pre-post-scripts false` ou
  remover a linha do `.npmrc`.

### Limpando caches quando houver chunks obsoletos

Se aparecerem erros tipo `Failed to fetch dynamically imported module`, `ChunkLoadError`
ou a tela ficar em branco após uma atualização, o cache do Vite ou os módulos
instalados provavelmente estão desatualizados. Em ordem do mais leve para o mais agressivo:

```bash
# 1) Só o cache do Vite (resolve 90% dos casos)
npm run clean:vite

# 2) Cache + reinstalar dependências + subir o dev (escolha o gerenciador)
npm run dev:clean
pnpm run dev:clean:pnpm
yarn run dev:clean:yarn

# 3) Reset completo: apaga node_modules e reinstala do zero
npm run clean:all          # mantém o lockfile
npm run clean:all:hard     # também apaga package-lock.json / bun.lock
```

Depois disso, faça um hard reload no navegador (Ctrl/Cmd + Shift + R) para descartar
chunks antigos cacheados pelo Service Worker.

### Solução de problemas

- **`Failed to fetch` em edge function** → verifique se o secret `*_SUPABASE_URL` correspondente está setado no projeto certo.
- **`401 Unauthorized` no catálogo** → confirme `VITE_EXTERNAL_SUPABASE_ANON_KEY` no `.env.local`.
- **Login não funciona** → no painel Supabase principal, em **Authentication → URL Configuration**, adicione `http://localhost:8080` em *Site URL* e *Redirect URLs*.
- **`ChunkLoadError` / tela branca após deploy** → rode `npm run clean:vite` (ou `npm run dev:clean`) e dê hard reload no navegador.

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
├── functions/        # 47 Edge Functions
│   ├── _shared/      # Utilitários compartilhados (CORS, auth, validação)
│   ├── expert-chat/  # Assistente IA
│   ├── external-db-bridge/ # Bridge para banco externo
│   └── ...
└── migrations/       # 205 migrations SQL versionadas
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
- 35+ tabelas com RLS completo
- 205 migrations versionadas e reproduzíveis
- Tipos gerados automaticamente (`supabase gen types`)
- Connection pooling via Supabase pooler

### Banco Externo (Promobrind)
- Acesso via Edge Function `external-db-bridge`
- Cache em memória com TTL de 10 minutos
- Fallback progressivo para resiliência
- Retry com backoff exponencial

---

## ⚡ Edge Functions

47 Edge Functions organizadas em categorias:

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

| Métrica | Valor |
|---|---|
| Arquivos TypeScript | ~907 |
| Linhas de código | ~180.000 |
| Edge Functions | 46 |
| Migrations SQL | 212 |
| Tabelas com RLS | 100% |
| Testes | 168 arquivos |
| TypeScript strict | ✅ |

---

## 📜 Licença

Projeto proprietário — todos os direitos reservados.

---

**Desenvolvido por Pink e Cerébro × Promo Brindes** 🚀
