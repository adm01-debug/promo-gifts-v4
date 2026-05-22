# Auditoria e Plano Pedagógico de Redeploy — Promo_Gifts

**Arquivo gerado em:** 13/05/2026 15:32:16 -03  
**Repositório:** `adm01-debug/Promo_Gifts`  
**Projeto Supabase:** `doufsxqlfjyuvxuezpln`  
**Objetivo:** consolidar, de forma pedagógica, a auditoria técnica e o plano de correções antes do redeploy seguro.

---

## 1. Resumo executivo

O projeto `Promo_Gifts` está bem estruturado e já possui integração com Supabase, GitHub Actions, Edge Functions, migrations, testes e scripts de segurança. O projeto Supabase correto é:

```txt
doufsxqlfjyuvxuezpln
```

A URL pública usada pelo frontend deve ser:

```env
VITE_SUPABASE_URL=https://doufsxqlfjyuvxuezpln.supabase.co
```

Os secrets principais já configurados no GitHub Actions foram:

```txt
SUPABASE_ACCESS_TOKEN
SUPABASE_SERVICE_ROLE_KEY
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_URL
```

Apesar disso, o projeto ainda não deve ir para redeploy final de produção sem antes corrigir os pontos de segurança listados neste documento.

---

## 2. Veredito atual

```txt
Status atual: NO-GO temporário para produção
Motivo: funções públicas sensíveis precisam de proteção extra antes do redeploy final
```

O projeto pode avançar para dry-run, CI, build, testes, preparação de branch e revisão de patch.

Ainda não deve avançar para redeploy final em produção, `supabase db push` sem drift check ou deploy final de todas as Edge Functions sem hardening.

---

## 3. Bloqueadores principais

### 3.1 `webhook-dispatcher`

A função `webhook-dispatcher` está pública via `verify_jwt = false` e usa `SUPABASE_SERVICE_ROLE_KEY`. Ela recebe `event`, `payload`, `replay_delivery_id`, `test_mode` e `test_webhook_id`.

Risco: se alguém descobrir a URL, pode tentar disparar eventos, replays ou testes de webhook.

Correção recomendada:

```txt
Adicionar WEBHOOK_DISPATCHER_SECRET
Exigir header x-dispatcher-secret
Rejeitar chamada sem secret
```

### 3.2 `connections-auto-test`

A função `connections-auto-test` está pública via `verify_jwt = false`. Ela foi criada para cron e retesta conexões ativas em `external_connections`.

Risco: se acionada publicamente, pode gerar ruído operacional, chamadas externas, logs, custo ou exposição indireta de status de credenciais.

Correção recomendada:

```txt
Adicionar CONNECTIONS_AUTO_TEST_SECRET
Exigir header x-cron-secret
Rejeitar chamada sem secret
```

### 3.3 Migrations sem drift check

A pasta `supabase/migrations` contém muitos arquivos, incluindo schemas completos, arquivos `FIXED`, migrations antigas de RLS, seeds, testes SQL e migrations pequenas com nomes UUID.

Exemplos de risco:

```txt
20250103_05_rls_remaining.sql
20250103_05_rls_remaining_FIXED.sql
20250103_complete_schema.sql
20250103_schema_no_gamification.sql
20250103_rls_policies.sql
20250103_rls_no_gamification.sql
```

Conclusão: não rodar `supabase db push` às cegas.

Antes de qualquer mudança de banco:

```bash
npx supabase link --project-ref doufsxqlfjyuvxuezpln
npx supabase migration list
npx supabase db diff --linked
```

Se o diff vier grande ou inesperado, parar e revisar.

---

## 4. Edge Functions auditadas

### 4.1 `e2e-cleanup`

Função destrutiva, mas com boa proteção.

Pontos positivos:

```txt
Usa x-e2e-cleanup-token
Compara com E2E_CLEANUP_TOKEN
Possui allowlist E2E_CLEANUP_ALLOWED_EMAILS
dryRun = true por padrão
Resolve user_id server-side
Não apaga auth.users
Registra auditoria
```

Condição para produção:

```txt
E2E_CLEANUP_ALLOWED_EMAILS deve conter apenas e-mails de teste.
E2E_CLEANUP_TOKEN deve ser forte, longo e secreto.
dryRun=false só deve ser usado com revisão.
```

Classificação: aceitável com condição.

### 4.2 `connections-auto-test`

Função sensível.

Pontos positivos:

```txt
Processa conexões em batch
Tem retry/backoff
Usa service client
Busca apenas conexões active + auto_test_enabled
```

Problema: não foi identificada autenticação própria obrigatória.

Classificação: bloqueador de produção até adicionar `CONNECTIONS_AUTO_TEST_SECRET`.

### 4.3 `image-proxy`

Função de proxy de imagem.

Pontos positivos:

```txt
Possui allowlist de domínio
Não é proxy aberto genérico
Usa bot/rate protection
Usa circuit breaker
Define cache-control
```

Ajustes recomendados:

```txt
localhost/127.0.0.1 somente em development
Validar Content-Type começando com image/
Limitar tamanho máximo da resposta
```

Classificação: aceitável com ajustes menores.

### 4.4 `webhook-inbound`

Função bem estruturada para receber webhooks externos.

Pontos positivos:

```txt
Busca endpoint ativo por slug
Usa hmac_secret_ref
Valida x-signature-256 ou x-webhook-signature
Calcula HMAC SHA-256
Usa comparação timing-safe
Registra eventos
Retorna 401 quando assinatura é inválida
```

Melhoria futura: adicionar anti-replay com timestamp + nonce/event_id.

Classificação: aceitável se todos os HMAC secrets estiverem configurados.

### 4.5 `webhook-dispatcher`

Função sensível.

Pontos positivos:

```txt
Assina payload com HMAC
Registra entregas
Faz retry/backoff
Desativa webhook após falhas consecutivas
```

Problema: não foi identificada autenticação própria obrigatória para chamada direta.

Classificação: bloqueador de produção até adicionar `WEBHOOK_DISPATCHER_SECRET`.

### 4.6 `crm-db-bridge`

Função grande e crítica.

Pontos positivos:

```txt
Usa CORS centralizado
Usa bot protection
Usa circuit breaker
Usa request-id
Usa resolver centralizado de credenciais
Usa cliente CRM singleton/warm-up
```

Riscos:

```txt
Está pública via verify_jwt = false
Acessa CRM externo
Possui diagnósticos
Pode expor status de credenciais, latência ou configuração se mal protegida
```

Classificação: alto risco; precisa revisão de rotas sensíveis antes do redeploy final.

### 4.7 `mcp-server`

Função crítica que usa service role e header `x-mcp-key`.

Pontos positivos:

```txt
Valida chave via RPC validate_mcp_key
Usa escopos
Registra auditoria
Separa permissões de ferramentas
```

Checklist obrigatório:

```txt
validate_mcp_key deve comparar hash, não plaintext
Chaves MCP não devem ficar em texto puro
Expiração/revogação precisam funcionar
Auditoria precisa estar ativa
Wildcard "*" só deve existir para chaves extremamente restritas
CORS precisa estar restrito
```

Classificação: aceitável com validação adicional.

### 4.8 `ai-recommendations`

Função pública no Supabase, mas com autenticação própria.

Pontos positivos:

```txt
Usa authenticateRequest(req)
Aplica rate limit por usuário
Usa bot protection
Valida entrada com zod
Usa controle de quota AI
Usa LOVABLE_API_KEY server-side
```

Classificação: aceitável.

### 4.9 `quote-public-view`

Foi encontrada referência em `supabase/config.toml`, mas o arquivo da função não foi encontrado em:

```txt
supabase/functions/quote-public-view/index.ts
```

Possibilidades:

```txt
A função foi removida e o config ficou obsoleto
A função existe com outro nome
A função deveria existir e está faltando
```

Ação recomendada:

```txt
Buscar chamadas para quote-public-view no frontend.
Se não houver uso, remover do config.toml.
Se houver uso, restaurar a função.
```

---

## 5. Variáveis e secrets necessários

### 5.1 Frontend / hosting

No Lovable, Vercel, Netlify ou outro hosting:

```env
VITE_SUPABASE_URL=https://doufsxqlfjyuvxuezpln.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Nunca colocar `SUPABASE_SERVICE_ROLE_KEY` no frontend.

### 5.2 GitHub Actions

No GitHub:

```env
SUPABASE_ACCESS_TOKEN=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=https://doufsxqlfjyuvxuezpln.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=
```

### 5.3 Supabase Edge Function Secrets

No Supabase:

```env
SUPABASE_SERVICE_ROLE_KEY=
LOVABLE_API_KEY=
E2E_CLEANUP_TOKEN=
E2E_CLEANUP_ALLOWED_EMAILS=
CONNECTIONS_AUTO_TEST_SECRET=
WEBHOOK_DISPATCHER_SECRET=
IMAGE_PROXY_ALLOW_LOCALHOST=false
IMAGE_PROXY_MAX_BYTES=5242880
```

Conforme integrações ativas:

```env
EXTERNAL_CRM_URL=
EXTERNAL_CRM_SERVICE_ROLE_KEY=
EXTERNAL_CRM_ANON_KEY=
EXTERNAL_SUPABASE_URL=
EXTERNAL_SUPABASE_SERVICE_KEY=
```

---

## 6. Patch mínimo recomendado

### 6.1 Proteger `connections-auto-test`

Adicionar validação de header:

```txt
Header: x-cron-secret
Secret: CONNECTIONS_AUTO_TEST_SECRET
```

Comportamento esperado:

```txt
Sem secret correto => 401 Unauthorized
Com secret correto => executa normalmente
```

### 6.2 Proteger `webhook-dispatcher`

Adicionar validação de header:

```txt
Header: x-dispatcher-secret
Secret: WEBHOOK_DISPATCHER_SECRET
```

Comportamento esperado:

```txt
Sem secret correto => 401 Unauthorized
Com secret correto => executa normalmente
```

### 6.3 Endurecer `image-proxy`

Adicionar:

```txt
Content-Type precisa começar com image/
Limite máximo de bytes
localhost apenas se IMAGE_PROXY_ALLOW_LOCALHOST=true
```

### 6.4 Criar `.env.example`

Criar arquivo raiz:

```env
VITE_SUPABASE_URL=https://doufsxqlfjyuvxuezpln.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=

# Server/Edge only - nunca usar no frontend
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ACCESS_TOKEN=
CONNECTIONS_AUTO_TEST_SECRET=
WEBHOOK_DISPATCHER_SECRET=
E2E_CLEANUP_TOKEN=
E2E_CLEANUP_ALLOWED_EMAILS=
LOVABLE_API_KEY=
```

---

## 7. Sequência segura de execução

### Fase 1 — hardening

```txt
1. Aplicar proteção em connections-auto-test
2. Aplicar proteção em webhook-dispatcher
3. Criar CONNECTIONS_AUTO_TEST_SECRET no Supabase
4. Criar WEBHOOK_DISPATCHER_SECRET no Supabase
```

### Fase 2 — ajustes menores

```txt
1. Criar .env.example
2. Ajustar image-proxy
3. Remover ou restaurar quote-public-view
4. Revisar diagnósticos de crm-db-bridge
```

### Fase 3 — validação local ou CI

```bash
npm ci
npm run build
npm run typecheck:full
npm run test
npm run test:coverage
npm run smoke
```

Se disponível:

```bash
npm run test:e2e:critical
```

### Fase 4 — Supabase drift check

```bash
npx supabase link --project-ref doufsxqlfjyuvxuezpln
npx supabase migration list
npx supabase db diff --linked
```

Regra: se o diff vier inesperado, parar. Não aplicar `db push` sem revisão.

### Fase 5 — Edge Functions

No GitHub Actions:

```txt
Actions > Deploy Edge Functions > Run workflow
```

Executar primeiro dry-run, se disponível.

### Fase 6 — Frontend

No hosting:

```txt
Confirmar VITE_SUPABASE_URL
Confirmar VITE_SUPABASE_PUBLISHABLE_KEY
Rodar redeploy da branch main
```

---

## 8. Checklist final de liberação

```txt
[ ] WEBHOOK_DISPATCHER_SECRET criado no Supabase
[ ] CONNECTIONS_AUTO_TEST_SECRET criado no Supabase
[ ] webhook-dispatcher rejeita chamada sem secret
[ ] connections-auto-test rejeita chamada sem secret
[ ] e2e-cleanup tem token forte
[ ] e2e-cleanup tem allowlist apenas de e-mails de teste
[ ] webhook-inbound tem HMAC secrets válidos
[ ] quote-public-view foi removido do config ou restaurado
[ ] npm run build passa
[ ] npm run typecheck:full passa
[ ] npm run test passa
[ ] CI passa no GitHub Actions
[ ] deploy Edge Functions passa
[ ] db diff revisado
[ ] nenhuma service role key no frontend
[ ] rollback definido
```

---

## 9. Plano de rollback

### Antes do redeploy

```txt
1. Anotar commit atual da branch main
2. Anotar último deploy funcional do frontend
3. Não aplicar migrations destrutivas
4. Fazer deploy de Edge Functions separado do frontend
5. Validar health checks antes de promover frontend
```

### Rollback frontend

```bash
git revert <commit_do_redeploy>
git push origin main
```

### Rollback Edge Functions

```bash
git checkout <commit_anterior>
supabase functions deploy <nome-da-funcao> --project-ref doufsxqlfjyuvxuezpln
```

### Rollback banco

Não fazer rollback de banco automaticamente. Rollback de schema só com SQL revisado, porque pode causar perda de dados.

---

## 10. Meta 10/10

Para chegar ao estado 10/10:

```txt
1. Aplicar patch de hardening
2. Criar secrets novos no Supabase
3. Rodar CI completo
4. Rodar build
5. Rodar testes
6. Rodar dry-run de Edge Functions
7. Fazer drift check do banco
8. Revisar quote-public-view
9. Validar hosting frontend
10. Fazer redeploy controlado com rollback pronto
```

Critério 10/10:

```txt
Produção só é liberada quando não houver função pública sensível sem autenticação própria, build/testes estiverem verdes, banco estiver revisado e rollback estiver documentado.
```

---

## 11. Local recomendado no GitHub

Caminho recomendado no repositório:

```txt
docs/redeploy/AUDITORIA_REDEPLOY_PROMO_GIFTS_2026-05-13_15-32.md
```

Mensagem de commit:

```txt
docs: add redeploy audit and hardening plan
```

---

## 12. Conclusão

O projeto está próximo de estar pronto para redeploy, mas ainda precisa de hardening em pontos específicos.

Prioridade absoluta:

```txt
1. Proteger webhook-dispatcher
2. Proteger connections-auto-test
3. Fazer drift check antes de qualquer db push
```

Depois dessas correções, o projeto pode seguir para validação final e redeploy controlado.
