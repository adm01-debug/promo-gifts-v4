# Jornadas fim-a-fim por persona (com rastreabilidade de rotas críticas)

## Objetivo
Descrever jornadas E2E para as personas-chave do sistema:
- anônimo
- usuário logado
- admin
- integração externa

Cada fluxo abaixo conecta explicitamente as etapas às rotas críticas já inventariadas em:
1. `scripts/smoke-tests.mjs` (`REQUIRED_ROUTES`, gate estático de CI).
2. `docs/E2E_SMOKE_COVERAGE.md` (catálogo de smoke autenticado por feature/rota).

---

## 1) Persona: **Anônimo**

### Fluxo A1 — Login via tela pública
**Pré-condições**
- Usuário sem sessão ativa.
- Aplicação acessível publicamente.

**Ação (fim-a-fim)**
1. Acessa `/login`.
2. Preenche credenciais válidas.
3. Submete formulário e aguarda conclusão de autenticação.

**Resultado esperado**
- Sessão autenticada criada com sucesso.
- Usuário passa a acessar rotas protegidas (ex.: `/produtos`).

**Rastreabilidade (rotas críticas)**
- `REQUIRED_ROUTES`: `/login`, `/produtos`.
- Smoke catalogado: `catalog` (`/produtos`).

---

### Fluxo A2 — Recuperação de senha
**Pré-condições**
- Usuário sem sessão.
- Conta existente para recuperação.

**Ação (fim-a-fim)**
1. Acessa `/reset-password`.
2. Inicia fluxo de redefinição.
3. Conclui redefinição e retorna ao login.

**Resultado esperado**
- Senha redefinida sem erro.
- Próximo login com nova senha é aceito.

**Rastreabilidade (rotas críticas)**
- `REQUIRED_ROUTES`: `/reset-password`, `/login`.

---

### Fluxo A3 — Callback de SSO
**Pré-condições**
- Usuário iniciou login social/SSO em IdP externo.
- IdP retorna para callback configurado.

**Ação (fim-a-fim)**
1. Navegador retorna para `/auth/callback` com parâmetros de autenticação.
2. Front processa callback e conclui sessão.
3. Usuário é direcionado para área autenticada.

**Resultado esperado**
- Sessão válida persistida.
- Acesso autorizado às rotas protegidas.

**Rastreabilidade (rotas críticas)**
- `REQUIRED_ROUTES`: `/auth/callback`, `/produtos`.

---

## 2) Persona: **Usuário logado (vendedor/operação)**

### Fluxo U1 — Catálogo → Novo orçamento
**Pré-condições**
- Sessão autenticada ativa.
- Usuário com permissão padrão de vendedor.

**Ação (fim-a-fim)**
1. Acessa `/produtos`.
2. Avalia itens no catálogo.
3. Navega para `/orcamentos`.
4. Inicia criação em `/orcamentos/novo`.

**Resultado esperado**
- Usuário consegue sair do discovery de produto e entrar no builder de orçamento sem bloqueios.

**Rastreabilidade (rotas críticas)**
- `REQUIRED_ROUTES`: `/produtos`, `/orcamentos`, `/orcamentos/novo`.
- Smoke catalogado: `catalog` (`/produtos`), `quotes-list` (`/orcamentos`), `quote-new` (`/orcamentos/novo`).

---

### Fluxo U2 — Operação diária de orçamento
**Pré-condições**
- Sessão autenticada.
- Existência de orçamentos no funil.

**Ação (fim-a-fim)**
1. Acessa `/orcamentos` (lista).
2. Acompanha pipeline em `/orcamentos/kanban`.
3. Analisa indicadores em `/orcamentos/dashboard`.

**Resultado esperado**
- Visão consistente entre lista, kanban e dashboard.
- Continuidade operacional do ciclo comercial.

**Rastreabilidade (rotas críticas)**
- `REQUIRED_ROUTES`: `/orcamentos`.
- Smoke catalogado: `quotes-list` (`/orcamentos`), `quotes-kanban` (`/orcamentos/kanban`), `quotes-dashboard` (`/orcamentos/dashboard`).

---

## 3) Persona: **Admin**

### Fluxo AD1 — Administração de usuários
**Pré-condições**
- Sessão autenticada.
- Papel com acesso a `AdminRoute`.

**Ação (fim-a-fim)**
1. Acessa `/admin/usuarios`.
2. Consulta e gerencia usuários.
3. (Opcional) aciona promoção em `/admin/usuarios/promover`.

**Resultado esperado**
- Página administrativa abre sem redirecionamento indevido.
- Operações de gestão refletem permissões corretas.

**Rastreabilidade (rotas críticas)**
- `REQUIRED_ROUTES`: `/admin/usuarios`.
- Referência de proteção: grupo `adminRoutes` sob `<AdminRoute />`.

---

### Fluxo AD2 — Governança técnica (admin/dev)
**Pré-condições**
- Sessão autenticada com privilégio elevado (Admin + DevRoute, quando aplicável).

**Ação (fim-a-fim)**
1. Acessa `/admin/conexoes` para status e credenciais de integrações.
2. Acessa `/admin/status` para saúde sistêmica.
3. Acessa `/admin/telemetria` para indicadores operacionais.

**Resultado esperado**
- Painéis críticos carregam sem erro.
- Admin consegue diagnosticar dependências externas e saúde da plataforma.

**Rastreabilidade (rotas críticas)**
- `REQUIRED_ROUTES` (âncora de área admin): `/admin/usuarios`.
- Rotas de apoio em `adminRoutes` (grupo dev-only).

---

## 4) Persona: **Integração externa**

> Observação: esta persona representa sistemas/IdPs/serviços terceiros interagindo com o app por pontos de integração (não um usuário humano navegando UI completa).

### Fluxo I1 — Provedor de identidade (SSO) → app
**Pré-condições**
- Integração SSO ativa com callback registrado.
- Usuário iniciou autenticação no provedor externo.

**Ação (fim-a-fim)**
1. IdP redireciona para `/auth/callback`.
2. App valida retorno e cria sessão.
3. Usuário segue para rota protegida alvo (ex.: `/produtos`).

**Resultado esperado**
- Handshake de identidade concluído.
- Sessão consistente no frontend.

**Rastreabilidade (rotas críticas)**
- `REQUIRED_ROUTES`: `/auth/callback`, `/produtos`.

---

### Fluxo I2 — Operação assistida por integração via admin
**Pré-condições**
- Admin logado com acesso dev-only.
- Credenciais/configuração de integração cadastradas.

**Ação (fim-a-fim)**
1. Admin valida integração em `/admin/conexoes` e `/admin/conexoes/status`.
2. Admin usa `/external-db-test` ou `/admin/external-db` para teste de conectividade.

**Resultado esperado**
- Conectividade e credenciais verificadas.
- Evidência operacional de que a integração externa está funcional.

**Rastreabilidade (rotas críticas)**
- Rota crítica-âncora de governança: `/admin/usuarios` (inventário smoke estático).
- Rotas operacionais de integração: `adminRoutes` (dev-only).

---

## Matriz resumida de rastreabilidade (persona × rotas)

| Persona | Fluxo | Rotas críticas conectadas |
|---|---|---|
| Anônimo | A1 Login | `/login` → `/produtos` |
| Anônimo | A2 Reset senha | `/reset-password` → `/login` |
| Anônimo | A3 SSO callback | `/auth/callback` → `/produtos` |
| Usuário logado | U1 Catálogo → orçamento | `/produtos` → `/orcamentos` → `/orcamentos/novo` |
| Usuário logado | U2 Operação de orçamento | `/orcamentos` (+ `/orcamentos/kanban`, `/orcamentos/dashboard`) |
| Admin | AD1 Gestão de usuários | `/admin/usuarios` |
| Admin | AD2 Governança técnica | `/admin/usuarios` (âncora) + `/admin/conexoes`, `/admin/status`, `/admin/telemetria` |
| Integração externa | I1 SSO | `/auth/callback` → `/produtos` |
| Integração externa | I2 Conectividade externa | `/admin/usuarios` (âncora) + `/admin/conexoes/status`, `/external-db-test`, `/admin/external-db` |

---

## Critério de aceite sugerido
- Todas as jornadas acima devem permanecer válidas após mudanças de roteamento.
- Qualquer alteração em `REQUIRED_ROUTES` exige atualização desta matriz.
- Qualquer inclusão/remoção de feature em `SMOKE_COVERAGE` deve refletir ao menos um fluxo de persona equivalente.
