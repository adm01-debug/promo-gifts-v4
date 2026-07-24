# Matriz de testes por função (Edge Functions)

Data de referência: **2026-05-25**.

## Catálogo de casos (aplicar a cada função)

| ID | Categoria | Cenário | Status code esperado | Payload esperado |
|---|---|---|---|---|
| C01 | Válido | Requisição mínima válida (headers + body/query obrigatórios) | `200`/`201`/`202` | JSON com `success=true` **ou** campo de domínio (`data`, `items`, `result`) |
| C02 | Inválido | Schema inválido (campo obrigatório ausente/tipo errado) | `400`/`422` | JSON com erro estruturado (`error`/`message`) e detalhe de validação |
| C03 | Limite | Payload no limite superior aceito (ex.: tamanho máximo, paginação máxima) | `200`/`206` | Resposta completa sem truncamento silencioso |
| C04 | AuthN | Sem credencial ou token inválido | `401` | JSON com erro de autenticação (`unauthorized`/`invalid token`) |
| C05 | AuthZ | Usuário autenticado sem permissão/escopo | `403` | JSON com erro de autorização (`forbidden`/`insufficient permissions`) |
| C06 | Timeout | Dependência lenta além do SLA (simulada) | `504`/`408`/`503` | JSON com erro transitório + indicação de retry (`retryable=true` quando suportado) |
| C07 | Dependência externa | Upstream indisponível, 5xx, DNS/TLS falha | `502`/`503`/`424` | JSON com erro de integração (`provider`, `reason`, `request_id`) |
| C08 | Idempotência | Repetição da mesma operação com mesma chave de idempotência | `200`/`201`/`409` | Mesmo resultado lógico da 1ª chamada ou conflito explícito sem duplicação |

> Observação: quando a função for estritamente interna/cron/webhook, os códigos podem variar para `202`, `204` ou `405` no fluxo principal. Ainda assim, C01–C08 devem ser validados no contrato.

## Matriz por função

| Função | Válido (C01) | Inválido (C02) | Limite (C03) | AuthN (C04) | AuthZ (C05) | Timeout (C06) | Dependência externa (C07) | Idempotência (C08) |
|---|---|---|---|---|---|---|---|---|
| ai-recommendations | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| analyze-logo-colors | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| bi-copilot | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| bitrix-sync | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| block-ip-temporarily | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| bulk-random-passwords | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| categories-api | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| cleanup-notifications | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| cleanup-novelties | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| cnpj-lookup | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| collections-watcher | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| commemorative-dates | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| comparison-ai-advisor | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| comparison-price-watcher | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| connection-tester | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| connections-auto-test | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| connections-health-check | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| connections-hub-audit | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| cors-audit | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| crm-db-bridge | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| detect-new-device | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| dropbox-list | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| e2e-cleanup | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| elevenlabs-scribe-token | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| elevenlabs-tts | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| expert-chat | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| external-db-bridge | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| external-db-inspect | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| favorites-watcher | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| force-global-logout | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| full-op-diagnostics | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| generate-ad-image | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| generate-ad-prompt | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| generate-mockup | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| generate-product-seo | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| get-visitor-info | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| github-credentials-test | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| health-check | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| image-proxy | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| kit-ai-builder | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| kit-identity-suggest | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| log-login-attempt | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| magic-up-score | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| manage-users | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| market-intelligence-insights | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| materials-api | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| mcp-keys-issue | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| mcp-keys-revoke | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| mcp-keys-rotate | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| mcp-keys-update | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| mcp-server | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| ownership-audit | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| ownership-repair | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| process-queue | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| process-scheduled-reports | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| product-webhook | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| quote-followup-reminders | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| quote-sync | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| rate-limit-check | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| rls-audit | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| rls-integration-tests | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| rls-matrix-export | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| secrets-manager | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| secure-upload | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| semantic-search | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| send-digest | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| send-notification | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| send-scheduled-reports | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| send-transactional-email | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| simulation-orchestrator | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| step-up-verify | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| sync-external-db | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| sync-quote-bitrix | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| test-contract-orchestrator | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| test-inventory-orchestrator | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| trends-insights | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| validate-access | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| verify-email | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| visual-search | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| voice-agent | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| webhook-dispatcher | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |
| webhook-inbound | 200 + `data` | 400/422 + `error` | 200/206 + página limite | 401 + `error` | 403 + `error` | 504/503 + `retryable` | 502/503 + `provider` | 200/409 sem duplicar |

