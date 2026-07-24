# E2E (Playwright)

Suíte de testes ponta-a-ponta cobrindo os fluxos críticos por módulo, com
captura automática de evidências em qualquer falha.

## Estrutura

```
e2e/
├── fixtures/
│   ├── auth.setup.ts       Login uma vez e salva storageState.json
│   ├── test-base.ts        test estendido com captura de console/erros e
│   │                        afterEach que coleta evidências em falha
│   └── selectors.ts        SSOT de seletores frágeis
├── helpers/
│   ├── evidence.ts         Screenshot, DOM, console.json, meta.json
│   ├── nav.ts              gotoAndSettle, expectNoConsoleErrors
│   └── forms.ts            fill/click resilientes
└── flows/
    ├── 01-auth.spec.ts
    ├── 02-navigation.spec.ts
    ├── 03-products.spec.ts
    ├── 04-quotes.spec.ts
    ├── 05-orders.spec.ts
    ├── 06-kit-builder.spec.ts
    ├── 07-collections.spec.ts
    ├── 08-favorites.spec.ts
    ├── 09-simulator.spec.ts
    ├── 10-admin.spec.ts
    └── 11-errors.spec.ts
```

## Configuração local

1. Copie `.env.e2e.example` para `.env.e2e`:
   ```bash
   cp .env.e2e.example .env.e2e
   ```
2. Preencha com credenciais de um usuário de teste real:
   ```
   E2E_USER_EMAIL=teste@exemplo.com
   E2E_USER_PASSWORD=SuaSenhaForte
   ```
3. Carregue antes de rodar:
   ```bash
   set -a && source .env.e2e && set +a
   npm run test:e2e
   ```

Sem essas variáveis, os specs autenticados são marcados `skip` automaticamente
(o setup grava um storageState vazio).

## Comandos

| Comando                       | Descrição                            |
|-------------------------------|--------------------------------------|
| `npm run test:e2e`            | Headless, todos os specs             |
| `npm run test:e2e:ui`         | Modo UI interativo                   |
| `npm run test:e2e:headed`     | Browser visível                      |
| `npm run test:e2e:debug`      | Inspector do Playwright              |
| `npm run test:e2e:report`     | Abre relatório HTML                  |
| `npm run test:e2e:install`    | Instala browser do Chromium          |

## Evidências em falha

Quando um teste falha, a fixture `evidence` anexa automaticamente ao relatório:

- `screenshot.png` (full page)
- `dom.html` (snapshot do HTML)
- `console.json` (todos os logs de console capturados)
- `page-errors.json` (se houver erros de runtime)
- `meta.json` (URL, viewport, título, timestamp)

Além disso, o Playwright gera por padrão (config):
- `trace.zip` (`retain-on-failure`)
- `video.webm` (`retain-on-failure`)

Tudo fica em `playwright-report/` (relatório HTML) e `e2e-artifacts/` (raw).

## CI

Workflow em `.github/workflows/e2e.yml`:
- Roda em todo push/PR contra `main`
- Specs públicos sempre rodam
- Specs autenticados só rodam se `E2E_USER_EMAIL`/`E2E_USER_PASSWORD`
  forem secrets do repositório
- Faz upload de `playwright-report` e `e2e-evidence` como artifacts (7 dias)

## Cobertura por módulo

| Módulo       | Login | Nav | Criar/Editar | Submeter | Erro |
|--------------|:-----:|:---:|:------------:|:--------:|:----:|
| Auth         |   ✓   |  —  |      —       |    ✓     |  ✓   |
| Navegação    |   —   |  ✓  |      —       |    —     |  ✓   |
| Produtos     |   —   |  ✓  |      ✓ filtro|    ✓     |  ✓   |
| Orçamentos   |   —   |  ✓  |      ✓       |    —*    |  ✓   |
| Pedidos      |   —   |  ✓  |      —       |    —     |  ✓   |
| Kit Builder  |   —   |  ✓  |      —       |    —     |  ✓   |
| Coleções     |   —   |  ✓  |      —       |    —     |  ✓   |
| Favoritos    |   —   |  ✓  |      ✓       |    ✓     |  ✓   |
| Simulador    |   —   |  ✓  |      —       |    —     |  ✓   |
| Admin        |   —   |  ✓  |      —       |    —     |  ✓   |
| Erros        |   —   |  —  |      —       |    —     |  ✓   |

\* Submissão de orçamentos é validada apenas até abertura do builder para
evitar criação de dados de teste no BD compartilhado. Para suíte completa
com cleanup, configure uma edge function `e2e-cleanup` gated por header
secreto.

## Checklist reutilizável para fluxos críticos (padrão de automação)

Use o template abaixo em todo fluxo crítico (frontend + backend), para remover
ambiguidade ao escrever cenários E2E, contratos de API e critérios de aceite.

### Template padrão por fluxo

| Item | O que definir | Exemplo de preenchimento |
|------|----------------|--------------------------|
| **Fluxo** | Nome único e objetivo de negócio | `Checkout > Finalizar pedido B2B` |
| **Pré-condições** | Estado inicial obrigatório | `Usuário autenticado, carrinho com 1 item válido` |
| **Gatilho** | Ação que inicia o fluxo | `Clique em "Finalizar pedido"` |
| **Sucesso esperado** | Resultado funcional visível | `Pedido criado e tela de confirmação exibida` |
| **Erro esperado** | Falha tratada e comportamento esperado | `Falha de pagamento mantém carrinho e exibe retry` |
| **Mensagem de validação (sucesso)** | Texto/chave de i18n que deve aparecer | `"Pedido enviado com sucesso"` / `checkout.success` |
| **Mensagem de validação (erro)** | Texto/chave de i18n de erro esperado | `"Não foi possível processar o pagamento"` |
| **Persistência de estado (frontend)** | O que persiste em storage/cache/UI | `Carrinho limpo no sucesso; mantido no erro` |
| **Persistência de estado (backend)** | Efeitos em banco/filas/eventos | `INSERT em orders + evento order.created` |
| **Status HTTP esperado** | Código por cenário | `201 (sucesso), 400 (validação), 401/403 (auth), 409 (conflito), 500 (inesperado)` |
| **Contrato de erro** | Shape mínimo padronizado da resposta | `{ code, message, details?, requestId }` |
| **Observabilidade** | Logs, métricas e rastreabilidade | `requestId propagado e log estruturado com outcome` |

### Checklist rápido (copiar/colar em issue, PR ou spec)

- [ ] **Sucesso** descrito de ponta a ponta (UI + API + dados).
- [ ] **Erro de negócio** descrito (regra violada, conflito ou bloqueio).
- [ ] **Erro técnico** descrito (timeout, indisponibilidade, exceção inesperada).
- [ ] **Mensagens de validação** definidas com texto final ou chave i18n.
- [ ] **Persistência frontend** definida (estado antes/depois, inclusive reload).
- [ ] **Persistência backend** definida (transação, idempotência, side effects).
- [ ] **Códigos HTTP** mapeados por cenário (2xx/4xx/5xx sem ambiguidade).
- [ ] **Contrato de erro** validado nos testes (campos mínimos e consistência).
- [ ] **Evidências de teste** previstas (screenshot/log/trace para falhas).

### Matriz mínima de status sugerida (backend)

- `200 OK`: consulta/ação síncrona concluída sem criação de recurso.
- `201 Created`: recurso criado com sucesso.
- `202 Accepted`: processamento assíncrono aceito (com rastreio posterior).
- `204 No Content`: sucesso sem payload.
- `400 Bad Request`: payload inválido/sintaxe semântica incorreta.
- `401 Unauthorized`: sem autenticação válida.
- `403 Forbidden`: autenticado sem permissão.
- `404 Not Found`: recurso inexistente ou não acessível no contexto.
- `409 Conflict`: conflito de estado/concorrência/idempotência.
- `422 Unprocessable Entity`: regra de negócio não satisfeita.
- `429 Too Many Requests`: limite/rate limit excedido.
- `500 Internal Server Error`: falha inesperada no servidor.
- `503 Service Unavailable`: dependência externa indisponível.

> Dica: sempre associe cada status a um cenário explícito no spec (`Given/When/Then`) e
> valide no teste tanto o código quanto a mensagem/código de erro retornado.

## Cleanup automático (pós-suite)

Para evitar acúmulo de favoritos, carrinhos, coleções, comparações e
orçamentos criados pelos testes, o `globalTeardown` chama a edge function
`e2e-cleanup` ao final da suite.

### Configuração

Defina os secrets no projeto e como variáveis no CI:

| Variável                       | Onde                  | Descrição                                                     |
|--------------------------------|-----------------------|---------------------------------------------------------------|
| `E2E_CLEANUP_TOKEN`            | Backend + CI          | Token compartilhado (gere com `openssl rand -hex 32`).        |
| `E2E_CLEANUP_ALLOWED_EMAILS`   | Backend (CSV)         | Lista de emails permitidos. Defesa em profundidade.           |
| `E2E_USER_EMAIL`               | CI                    | Email do usuário de teste — alvo do cleanup.                  |
| `E2E_ADMIN_EMAIL`              | CI (opcional)         | Email do admin de teste — também é limpo.                     |
| `VITE_SUPABASE_URL`            | CI                    | URL do backend (já preenchida em `.env`).                     |
| `E2E_CLEANUP_DRY_RUN`          | CI (opcional)         | `1` = só conta, não apaga.                                    |

### Como funciona (camadas de segurança)

1. **Token** — `x-e2e-cleanup-token` precisa bater com `E2E_CLEANUP_TOKEN`.
2. **Allow-list** — o `email` do body precisa estar em
   `E2E_CLEANUP_ALLOWED_EMAILS`. Sem isso, mesmo com o token correto, 403.
3. **Lookup server-side** — `user_id` é resolvido via `auth.admin`; o
   cliente nunca passa UUID.
4. **Dry-run default** — body sem `dryRun: false` apenas conta linhas.

### Rodar manualmente

```bash
curl -X POST "$VITE_SUPABASE_URL/functions/v1/e2e-cleanup" \
  -H "x-e2e-cleanup-token: $E2E_CLEANUP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"e2e-tester@promogifts.com.br","dryRun":true}'
```

Resposta:

```json
{
  "ok": true,
  "dryRun": true,
  "userId": "…",
  "deleted": { "favorite_items": 12, "seller_carts": 2, "quotes": 1 },
  "totalMs": 184
}
```

### Adicionar novas tabelas

Edite `supabase/functions/e2e-cleanup/index.ts`:

- Tabela com `user_id` → adicione em `USER_ID_TABLES` (filhos antes dos pais).
- Tabela filha de `quotes` (FK `quote_id`) → adicione em
  `QUOTE_CHILD_TABLES_BY_QUOTE_ID`.

A function nunca toca em `auth.users`, no catálogo externo nem em tabelas
globais (admin_settings, ai_usage_*, etc.).

## Convenção de seletores (anti-flakiness)

Os specs evitam strings frágeis (texto traduzido, `h1, h2`, `article`).
Toda referência a elementos passa pelo SSOT em `e2e/fixtures/selectors.ts`:

```ts
import { Sel } from "../fixtures/selectors";
await page.fill(Sel.login.email, "x@y.com");
await page.locator(Sel.login.submit).first().click();
await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible();
```

Grupos disponíveis: `Sel.login`, `Sel.sidebar`, `Sel.page`, `Sel.product`,
`Sel.quote`, `Sel.favorites`, `Sel.cart`, `Sel.app`.

### Adicionando um novo seletor

1. No componente React, adicione `data-testid="kebab-case"` (sufixos
   recomendados: `-input`, `-submit`, `-toggle`, `-list`, `-item`, `-card`).
2. No `selectors.ts`, exponha como `[data-testid="..."]` — opcionalmente com
   um fallback de transição (`, h1, h2`, `, #id`, role-based).
3. Use `Sel.<grupo>.<chave>` no spec; nunca hard-code o seletor.

Quando todos os componentes-alvo já têm o testid, remova o fallback do SSOT
para evitar matches espúrios.
