# Ambientes e Paridade Mínima (local / CI / staging)

> Última revisão: 2026-05-25

## 1) Objetivo

Este documento define:
- Como cada ambiente executa o projeto.
- Quais variáveis são obrigatórias por ambiente.
- Onde segredos devem viver (e onde **não** devem viver).
- Limitações conhecidas de execução.
- Um baseline de **paridade mínima CI ↔ staging** para reduzir "passa no CI e quebra em staging".

---

## 2) Ambientes

### Local (desenvolvimento)
- Uso: desenvolvimento diário, debug, testes rápidos.
- Runtime principal: Node.js 20 LTS + npm.
- Fonte de variáveis: `.env.local` (não versionado).
- Banco/serviços: pode usar endpoints reais ou stubs, dependendo da task.

### CI (GitHub Actions)
- Uso: gates obrigatórios de qualidade (lint, typecheck, testes, segurança).
- Runtime principal: Node.js 20 LTS + npm (sem estado persistente entre jobs).
- Fonte de variáveis: GitHub Secrets/Variables e arquivos de exemplo para testes específicos (ex.: `.env.e2e.example`).
- Banco/serviços: preferencialmente stubs/mocks; integrações reais somente quando o job for explicitamente de integração.

### Staging (Vercel preview/beta)
- Uso: validação pré-produção com comportamento mais próximo de runtime real.
- Runtime principal: build/deploy Vercel + variáveis no painel do projeto.
- Fonte de variáveis: Environment Variables do Vercel (Preview/Production conforme escopo).
- Banco/serviços: integrações reais esperadas (com credenciais e escopos controlados).

---

## 3) Variáveis obrigatórias por ambiente

> Regra de ouro: variáveis `VITE_*` são públicas no bundle do frontend; nunca colocar segredo em `VITE_*`.

### 3.1 Frontend (mínimo obrigatório)

| Variável | Local | CI | Staging | Tipo | Observação |
|---|---|---|---|---|---|
| `VITE_SUPABASE_URL` | obrigatório | obrigatório (real ou stub válido para testes) | obrigatório | pública | URL do projeto Supabase. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | obrigatório | obrigatório (real ou stub válido para testes) | obrigatório | pública | Chave publishable/anon do Supabase. |

### 3.2 Testes E2E / smoke (quando aplicável)

| Variável | Local | CI | Staging | Tipo | Observação |
|---|---|---|---|---|---|
| `E2E_BASE_URL` | opcional | recomendada | recomendada | pública | Define alvo dos testes E2E. |
| Variáveis listadas em `.env.e2e.example` | conforme cenário | obrigatórias no job correspondente | n/a | mista | Usar apenas no contexto dos jobs de E2E. |

### 3.3 Backend / Edge Functions (segredos)

As credenciais de backend/edge **não** devem ir para `.env.local` de frontend nem para `VITE_*`.
Devem ficar em:
- **Supabase Edge Functions Secrets** (Deno env),
- **GitHub Secrets** (somente para jobs CI que precisam delas),
- **Vercel Environment Variables** (apenas quando o runtime de staging precisar).

Inventários e contexto:
- `recovery/block19_secrets_inventory.md`
- `recovery/block22_edge_secrets_inventory.md`
- `docs/INCIDENTS/2026-04-env-exposure.md`

---

## 4) Política de segredos

1. Nunca commitar `.env`, `.env.local` ou qualquer credencial real.
2. Nunca expor segredo em variáveis `VITE_*`.
3. Rotacionar imediatamente qualquer segredo exposto.
4. Preferir princípio do menor privilégio (tokens dedicados por ambiente).
5. Registrar mudanças sensíveis em runbook/incident log.

---

## 5) Limitações de execução (por ambiente)

### Local
- Pode divergir de CI por OS, recursos da máquina e presença de cache.
- Pode divergir de staging por ausência de integrações reais.

### CI
- Ambiente efêmero; não assumir estado entre jobs.
- Timeouts e paralelismo podem causar flakiness em suites longas.
- Parte dos testes de integração pode ser `skip` sem credenciais reais (comportamento intencional).

### Staging
- Pode ter dados mais próximos de produção e revelar problemas não visíveis em CI com stubs.
- Pode sofrer variabilidade de serviços externos (latência, rate-limit, indisponibilidade parcial).

---

## 6) Paridade mínima obrigatória: CI ↔ staging

Checklist de baseline:

- [ ] **Mesma major de Node** (atual: 20 LTS).
- [ ] **Mesmo gerenciador de pacotes** (`npm`) e lockfile versionado.
- [ ] `VITE_SUPABASE_URL` presente nos dois ambientes.
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` presente nos dois ambientes.
- [ ] Jobs CI de build executam com variáveis equivalentes às do staging (ao menos no frontend público).
- [ ] Smoke de rotas críticas executado contra staging após deploy.
- [ ] Regras de segurança (secret scanning / push protection / branch protection) ativas antes de promover mudanças.

### Critério de aceite de paridade

Consideramos paridade mínima atendida quando:
1. Build de CI e build de staging usam stack equivalente (Node/npm + lockfile).
2. Variáveis públicas mínimas de frontend estão definidas e válidas nos dois ambientes.
3. Smoke de staging passa no mesmo commit validado em CI.

---

## 7) Procedimento rápido de validação antes de merge

1. Confirmar presença de variáveis mínimas no CI e no staging.
2. Rodar gates de CI obrigatórios do repositório.
3. Publicar preview/staging no mesmo SHA.
4. Rodar smoke de rotas críticas em staging.
5. Se falhar em staging e passar no CI, abrir incidente de paridade e corrigir antes de promover.

---

## 8) Referências

- `README.md` (setup local e variáveis básicas)
- `docs/DEPLOYMENT.md` (deploy e pré-requisitos)
- `docs/BRANCH_PROTECTION.md`
- `docs/SECURITY_ALERTS.md`
- `docs/INCIDENTS/2026-04-env-exposure.md`
