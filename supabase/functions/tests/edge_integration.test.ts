/**
 * Suite de integração Edge organizada por função em tests/integration/edge/<function-name>.
 * Cada caso é mapeado para uma regra de negócio e reportado no sumário final por função.
 */
import "./integration/edge/cnpj-lookup/validation_test.ts";
import "./integration/edge/validate-access/status_test.ts";
import "./integration/edge/webhook-inbound/hmac_test.ts";
import "./integration/edge/bitrix-sync/contracts_test.ts";
import "./integration/edge/external-db-bridge/security_latency_test.ts";
import "./integration/edge/crm-db-bridge/contracts_test.ts";
import "./integration/edge/expert-chat/contracts_test.ts";
import "./integration/edge/sync-quote-bitrix/contracts_test.ts";
