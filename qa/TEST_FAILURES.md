# Relatório de Falhas de Testes

Gerado em: 2026-06-17T18:35:44.952Z

- Arquivos com falha: **102**
- Testes falhando: **688** / 1019 no escopo das suítes vermelhas

## Sumário por categoria

| Prioridade | Categoria | Arquivos | Testes falhando |
|---|---|---:|---:|
| P0 | Segurança / authz | 2 | 33 |
| P1 | Libs | 3 | 6 |
| P1 | Hooks | 2 | 15 |
| P1 | Componentes | 7 | 21 |
| P1 | Páginas | 2 | 2 |
| P1 | Integração | 1 | 1 |
| P2 | Outros | 6 | 22 |
| P2 | Admin / snapshots | 2 | 8 |
| P2 | Observabilidade | 1 | 1 |
| P2 | Edge Functions (live) | 76 | 579 |

## P0 — Segurança / authz

| Arquivo | Falhando | Total |
|---|---:|---:|
| `tests/security/edge-authz-bypass.test.ts` | 32 | 44 |
| `tests/security/rls-validation.test.ts` | 1 | 2 |

## P1 — Libs

| Arquivo | Falhando | Total |
|---|---:|---:|
| `tests/lib/theme-presets.test.ts` | 3 | 166 |
| `tests/lib/notifications-metrics-budget.test.ts` | 2 | 10 |
| `tests/lib/postgrest-migration.test.ts` | 1 | 8 |

## P1 — Hooks

| Arquivo | Falhando | Total |
|---|---:|---:|
| `tests/hooks/useSearch.test.ts` | 14 | 14 |
| `tests/hooks/hooks-audit-bugfix-08-14.test.ts` | 1 | 21 |

## P1 — Componentes

| Arquivo | Falhando | Total |
|---|---:|---:|
| `tests/components/ProductQuickActions.test.tsx` | 9 | 9 |
| `tests/components/products/FutureStockModal.test.tsx` | 5 | 5 |
| `tests/components/PriceFreshnessBadge.a11y.test.tsx` | 2 | 15 |
| `tests/components/RootInteractivityGuard.test.tsx` | 2 | 4 |
| `tests/components/KitComposition.test.tsx` | 1 | 26 |
| `tests/components/NotificationDrawer-trigger-to-fetch-timing.test.tsx` | 1 | 5 |
| `tests/components/products/ProductGallery.test.tsx` | 1 | 3 |

## P1 — Páginas

| Arquivo | Falhando | Total |
|---|---:|---:|
| `tests/pages/MockupHistoryPage.test.tsx` | 1 | 6 |
| `tests/pages/NotFound.test.tsx` | 1 | 5 |

## P1 — Integração

| Arquivo | Falhando | Total |
|---|---:|---:|
| `tests/integration/massive-fuzzing.test.ts` | 1 | 1 |

## P2 — Outros

| Arquivo | Falhando | Total |
|---|---:|---:|
| `tests/e2e/optimized-image.spec.ts` | 16 | 0 |
| `tests/e2e/role-badge-no-tooltip.spec.ts` | 2 | 0 |
| `tests/contexts/AuthContext.test.tsx` | 1 | 5 |
| `src/tests/ProductSortingRelevance.test.ts` | 1 | 12 |
| `src/tests/skeleton-integrity.test.ts` | 1 | 3 |
| `src/tests/ProductFetch.test.ts` | 1 | 2 |

## P2 — Admin / snapshots

| Arquivo | Falhando | Total |
|---|---:|---:|
| `tests/admin/skeleton-snapshots.test.tsx` | 7 | 26 |
| `tests/admin/aschild-nesting-checker.test.ts` | 1 | 1 |

## P2 — Observabilidade

| Arquivo | Falhando | Total |
|---|---:|---:|
| `tests/observability/structured-logger.test.ts` | 1 | 4 |

## P2 — Edge Functions (live)

| Arquivo | Falhando | Total |
|---|---:|---:|
| `tests/edge-functions/live/secure-upload.test.ts` | 10 | 10 |
| `tests/edge-functions/live/cnpj-lookup.test.ts` | 10 | 10 |
| `tests/edge-functions/live/simulation-orchestrator.test.ts` | 9 | 9 |
| `tests/edge-functions/live/generate-mockup.test.ts` | 9 | 9 |
| `tests/edge-functions/live/product-webhook.test.ts` | 9 | 9 |
| `tests/edge-functions/live/semantic-search.test.ts` | 9 | 9 |
| `tests/edge-functions/live/webhook-inbound.test.ts` | 9 | 9 |
| `tests/edge-functions/live/categories-api.test.ts` | 9 | 9 |
| `tests/edge-functions/live/materials-api.test.ts` | 9 | 10 |
| `tests/edge-functions/live/image-proxy.test.ts` | 9 | 9 |
| `tests/edge-functions/live/test-contract-orchestrator.test.ts` | 8 | 8 |
| `tests/edge-functions/live/market-intelligence-insights.test.ts` | 8 | 8 |
| `tests/edge-functions/live/comparison-price-watcher.test.ts` | 8 | 8 |
| `tests/edge-functions/live/elevenlabs-scribe-token.test.ts` | 8 | 8 |
| `tests/edge-functions/live/connections-health-check.test.ts` | 8 | 8 |
| `tests/edge-functions/live/process-scheduled-reports.test.ts` | 8 | 8 |
| `tests/edge-functions/live/send-scheduled-reports.test.ts` | 8 | 8 |
| `tests/edge-functions/live/bulk-random-passwords.test.ts` | 8 | 8 |
| `tests/edge-functions/live/cleanup-notifications.test.ts` | 8 | 8 |
| `tests/edge-functions/live/connections-hub-audit.test.ts` | 8 | 8 |
| `tests/edge-functions/live/comparison-ai-advisor.test.ts` | 8 | 8 |
| `tests/edge-functions/live/rls-integration-tests.test.ts` | 8 | 8 |
| `tests/edge-functions/live/test-cart-concurrency.test.ts` | 8 | 8 |
| `tests/edge-functions/live/block-ip-temporarily.test.ts` | 8 | 8 |
| `tests/edge-functions/live/kit-identity-suggest.test.ts` | 8 | 8 |
| `tests/edge-functions/live/analyze-logo-colors.test.ts` | 8 | 8 |
| `tests/edge-functions/live/collections-watcher.test.ts` | 8 | 8 |
| `tests/edge-functions/live/commemorative-dates.test.ts` | 8 | 8 |
| `tests/edge-functions/live/force-global-logout.test.ts` | 8 | 8 |
| `tests/edge-functions/live/ai-recommendations.test.ts` | 8 | 8 |
| `tests/edge-functions/live/generate-ad-prompt.test.ts` | 8 | 8 |
| `tests/edge-functions/live/external-db-bridge.test.ts` | 8 | 8 |
| `tests/edge-functions/live/cleanup-novelties.test.ts` | 8 | 8 |
| `tests/edge-functions/live/detect-new-device.test.ts` | 8 | 8 |
| `tests/edge-functions/live/connection-tester.test.ts` | 8 | 8 |
| `tests/edge-functions/live/favorites-watcher.test.ts` | 8 | 8 |
| `tests/edge-functions/live/generate-ad-image.test.ts` | 8 | 9 |
| `tests/edge-functions/live/log-login-attempt.test.ts` | 8 | 8 |
| `tests/edge-functions/live/rls-matrix-export.test.ts` | 8 | 8 |
| `tests/edge-functions/live/sync-quote-bitrix.test.ts` | 8 | 8 |
| `tests/edge-functions/live/get-visitor-info.test.ts` | 8 | 8 |
| `tests/edge-functions/live/sync-external-db.test.ts` | 8 | 8 |
| `tests/edge-functions/live/mcp-keys-revoke.test.ts` | 8 | 8 |
| `tests/edge-functions/live/verify-2fa-token.test.ts` | 8 | 8 |
| `tests/edge-functions/live/mcp-keys-rotate.test.ts` | 8 | 8 |
| `tests/edge-functions/live/mcp-keys-update.test.ts` | 8 | 8 |
| `tests/edge-functions/live/secrets-manager.test.ts` | 8 | 8 |
| `tests/edge-functions/live/test-cart-limit.test.ts` | 8 | 8 |
| `tests/edge-functions/live/validate-access.test.ts` | 8 | 8 |
| `tests/edge-functions/live/elevenlabs-tts.test.ts` | 8 | 8 |
| `tests/edge-functions/live/kit-ai-builder.test.ts` | 8 | 8 |
| `tests/edge-functions/live/magic-up-score.test.ts` | 8 | 8 |
| `tests/edge-functions/live/mcp-keys-issue.test.ts` | 8 | 8 |
| `tests/edge-functions/live/crm-db-bridge.test.ts` | 8 | 8 |
| `tests/edge-functions/live/process-queue.test.ts` | 8 | 8 |
| `tests/edge-functions/live/test-cart-rls.test.ts` | 8 | 8 |
| `tests/edge-functions/live/dropbox-list.test.ts` | 8 | 8 |
| `tests/edge-functions/live/manage-users.test.ts` | 8 | 8 |
| `tests/edge-functions/live/verify-email.test.ts` | 8 | 8 |
| `tests/edge-functions/live/audit-suite.test.ts` | 8 | 8 |
| `tests/edge-functions/live/bitrix-sync.test.ts` | 8 | 8 |
| `tests/edge-functions/live/send-digest.test.ts` | 8 | 8 |
| `tests/edge-functions/live/voice-agent.test.ts` | 8 | 8 |
| `tests/edge-functions/live/bi-copilot.test.ts` | 8 | 8 |
| `tests/edge-functions/live/quote-sync.test.ts` | 8 | 8 |
| `tests/edge-functions/live/rls-audit.test.ts` | 8 | 8 |
| `tests/edge-functions/live/quote-followup-reminders.test.ts` | 7 | 8 |
| `tests/edge-functions/live/send-notification.test.ts` | 7 | 8 |
| `tests/edge-functions/live/ownership-audit.test.ts` | 7 | 8 |
| `tests/edge-functions/live/visual-search.test.ts` | 7 | 8 |
| `tests/edge-functions/live/connections-auto-test.test.ts` | 6 | 8 |
| `tests/edge-functions/live/test-inventory-orchestrator.test.ts` | 1 | 8 |
| `tests/edge-functions/live/generate-blurhashes.test.ts` | 1 | 7 |
| `tests/edge-functions/live/hash-product-images.test.ts` | 1 | 7 |
| `tests/edge-functions/live/word-magic.test.ts` | 1 | 10 |
| `tests/edge-functions/live/load-test.test.ts` | 1 | 8 |
