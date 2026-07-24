/**
 * Mapa de impacto por secret.
 *
 * Para cada chave conhecida, descreve **quais telas e fluxos do produto
 * deixam de funcionar** quando o valor estiver ausente ou vazio.
 *
 * Usado nos tooltips do `/admin/conexoes` (SecretField, ConnectionsOverviewTable)
 * para que o admin entenda imediatamente o blast radius antes de remover
 * ou rotacionar uma credencial.
 *
 * MANTER em sintonia com `secretWhitelist.ts` — toda chave da whitelist
 * deve ter (ou herdar via fallback) uma entrada aqui.
 */

export interface SecretImpact {
  /** Subsistema ao qual a chave pertence (rótulo curto para o tooltip). */
  system: string;
  /** Telas / rotas afetadas (caminhos amigáveis). */
  screens: string[];
  /** Fluxos de negócio afetados (verbos de ação). */
  flows: string[];
  /** Severidade percebida quando ausente. */
  severity: 'critical' | 'high' | 'low' | 'medium';
}

const PROMOBRIND_FULL: SecretImpact = {
  system: 'Banco externo Promobrind (catálogo SSOT)',
  screens: [
    '/catalogo (grade, lista, tabela)',
    '/produto/:slug (PDP)',
    '/comparar (comparador)',
    '/admin/conexoes → 🐛 Debug (preview de produtos)',
    '/bi → indicadores de catálogo',
  ],
  flows: [
    'Listagem e busca de produtos',
    'Resolução de variantes/cores',
    'Cálculo de preço e frescor (price_updated_at)',
    'Adicionar ao orçamento / carrinho (lookup de SKU)',
    'Sincronização de categorias e enriquecimento',
  ],
  severity: 'critical',
};

const PROMOBRIND_READONLY: SecretImpact = {
  ...PROMOBRIND_FULL,
  flows: [
    'Listagem e busca de produtos (modo somente leitura)',
    'Resolução de variantes/cores',
    'Render de imagens e estoque',
  ],
  severity: 'critical',
};

const CRM_FULL: SecretImpact = {
  system: 'Banco externo CRM (companies/contacts)',
  screens: [
    '/orcamentos/novo → seletor de empresa',
    '/orcamentos → contatos e responsáveis',
    '/admin/conexoes → CRM bridge',
    '/bi → métricas comerciais',
  ],
  flows: [
    'Busca de empresas/contatos no carrinho e orçamento',
    'Sincronização de orçamento com Bitrix24/SalesPro',
    'Aprovação pública e assinatura eletrônica (lookup de cliente)',
  ],
  severity: 'high',
};

const CRM_READONLY: SecretImpact = {
  ...CRM_FULL,
  flows: ['Busca de empresas/contatos (somente leitura)', 'Listagem de responsáveis em orçamentos'],
  severity: 'high',
};

export const SECRET_IMPACT_MAP: Readonly<Record<string, SecretImpact>> = {
  // Promobrind (catálogo SSOT)
  EXTERNAL_PROMOBRIND_URL: PROMOBRIND_FULL,
  EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY: PROMOBRIND_FULL,
  EXTERNAL_PROMOBRIND_ANON_KEY: PROMOBRIND_READONLY,

  // CRM
  EXTERNAL_CRM_URL: CRM_FULL,
  EXTERNAL_CRM_SERVICE_ROLE_KEY: CRM_FULL,
  EXTERNAL_CRM_ANON_KEY: CRM_READONLY,

  // Bitrix24 (sync de orçamentos)
  BITRIX24_WEBHOOK_URL: {
    system: 'Bitrix24 — webhook de sincronização',
    screens: [
      '/orcamentos (status sync)',
      '/orcamentos/:id (push para Bitrix)',
      '/admin/conexoes → aba Bitrix24',
    ],
    flows: [
      'Push de orçamentos aprovados como deals',
      'Atualização de status no funil',
      'Notificação de assinatura eletrônica',
    ],
    severity: 'high',
  },
  BITRIX24_DOMAIN: {
    system: 'Bitrix24 — base URL',
    screens: ['/orcamentos', '/admin/conexoes → aba Bitrix24'],
    flows: ['Resolução de URL para todas as chamadas Bitrix'],
    severity: 'high',
  },
  BITRIX24_USER_ID: {
    system: 'Bitrix24 — autenticação',
    screens: ['/orcamentos', '/admin/conexoes → aba Bitrix24'],
    flows: ['Autenticação de webhooks; deals criados sem owner correto'],
    severity: 'medium',
  },
  BITRIX24_TOKEN: {
    system: 'Bitrix24 — autenticação',
    screens: ['/orcamentos', '/admin/conexoes → aba Bitrix24'],
    flows: ['Validação de webhook; sync falha em 401'],
    severity: 'high',
  },

  // n8n (automações)
  N8N_BASE_URL: {
    system: 'n8n — automações e workflows',
    screens: ['/admin/conexoes → aba n8n', 'Disparos de workflows a partir do app'],
    flows: ['Execução de workflows agendados', 'Recebimento de webhooks externos'],
    severity: 'medium',
  },
  N8N_API_KEY: {
    system: 'n8n — autenticação',
    screens: ['/admin/conexoes → aba n8n'],
    flows: ['Listagem e gatilho de workflows protegidos'],
    severity: 'medium',
  },

  // MCP (model context protocol)
  MCP_SHARED_SECRET: {
    system: 'MCP — integração com IA externa',
    screens: ['/admin/conexoes → aba MCP', 'Flow (assistente IA)'],
    flows: ['Validação de requisições MCP', 'Compartilhamento de contexto com agentes externos'],
    severity: 'medium',
  },

  // GitHub (código-fonte do app via MCP full)
  GITHUB_TOKEN: {
    system: 'GitHub — Personal Access Token (MCP full)',
    screens: [
      '/admin/conexoes → aba MCP',
      'Tools de código-fonte do MCP server',
      "Flow / agentes externos com chave MCP '*'",
    ],
    flows: [
      'list_repo_files — lista arquivos e diretórios do repositório (GET /repos/.../contents)',
      'read_repo_file — lê o conteúdo de um arquivo específico para contexto do agente',
      'write_repo_file — cria commit em branch alvo (PUT /repos/.../contents) para edições propostas pela IA',
      "Sem o token todas as 3 tools retornam 401 e a chave MCP '*' perde poder de edição de código",
    ],
    severity: 'critical',
  },
  GITHUB_REPO: {
    system: 'GitHub — repositório alvo (owner/repo)',
    screens: ['/admin/conexoes → aba MCP', 'Tools de código-fonte do MCP server'],
    flows: [
      "list_repo_files — sem o repo, não há onde listar (falha com 'repo undefined')",
      'read_repo_file — leitura de qualquer arquivo é abortada antes da chamada HTTP',
      'write_repo_file — commits são bloqueados; nenhuma edição da IA chega ao GitHub',
    ],
    severity: 'critical',
  },
  GITHUB_DEFAULT_BRANCH: {
    system: 'GitHub — branch padrão para escrita',
    screens: ['/admin/conexoes → aba MCP', 'Tools de código-fonte do MCP server'],
    flows: [
      'list_repo_files — usado como ref padrão quando o agente não especifica branch',
      'read_repo_file — define de qual branch o conteúdo é lido (default → main se ausente)',
      'write_repo_file — branch alvo dos commits da IA; recomendado mcp-edits/* para isolar de produção',
      "Sem este valor, escritas caem direto em 'main' — risco alto de quebrar produção",
    ],
    severity: 'medium',
  },
};

/** Fallback para nomes prefixados (OUTBOUND_WEBHOOK_SECRET_*, INBOUND_WEBHOOK_HMAC_*). */
function impactForPrefix(name: string): SecretImpact | null {
  if (name.startsWith('OUTBOUND_WEBHOOK_SECRET_')) {
    const target = name.replace('OUTBOUND_WEBHOOK_SECRET_', '');
    return {
      system: `Webhook saída → ${target || 'destino'}`,
      screens: ['/admin/conexoes → aba Webhooks'],
      flows: [
        `Assinatura HMAC dos eventos enviados para ${target || 'este destino'}`,
        'Receivers que validam assinatura rejeitarão eventos como 401/403',
      ],
      severity: 'high',
    };
  }
  if (name.startsWith('INBOUND_WEBHOOK_HMAC_')) {
    const source = name.replace('INBOUND_WEBHOOK_HMAC_', '');
    return {
      system: `Webhook entrada ← ${source || 'origem'}`,
      screens: ['/admin/conexoes → aba Webhooks'],
      flows: [
        `Validação de assinatura dos webhooks recebidos de ${source || 'esta origem'}`,
        'Eventos serão silenciosamente descartados se a chave estiver ausente',
      ],
      severity: 'high',
    };
  }
  return null;
}

/**
 * Resolve o impacto para um nome de secret. Retorna `null` apenas se a
 * chave for desconhecida (não está na whitelist nem em prefixo conhecido) —
 * nesse caso o consumidor pode mostrar um tooltip genérico.
 */
export function getSecretImpact(name: string): SecretImpact | null {
  if (!name) return null;
  return SECRET_IMPACT_MAP[name] ?? impactForPrefix(name);
}
