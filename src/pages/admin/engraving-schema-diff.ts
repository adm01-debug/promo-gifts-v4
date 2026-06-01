/**
 * Schema esperado pelo front para as 4 tabelas de Gravação.
 * Usado pela página AdminExternalDbPage para comparar com o schema real
 * retornado pela edge function external-db-inspect (mode: 'columns').
 *
 * Quando o usuário clica em "Comparar tipos do front com schema atual",
 * cada tabela é inspecionada e geramos um diff:
 *  - missingInDb:  campos que o front lê mas não existem mais no banco (BREAKING).
 *  - newInDb:      campos novos no banco que o front ainda não consome (oportunidade).
 */

export interface ExpectedTable {
  table: string;
  /** Campos que o front lê hoje (ver src/types/gravacao*.ts e hooks de gravação). */
  expectedColumns: string[];
  /** Arquivos do front que dependem desta tabela (para a UI mostrar o impacto). */
  consumers: string[];
}

export const ENGRAVING_TABLES: ExpectedTable[] = [
  {
    table: 'tabela_preco_gravacao_oficial',
    expectedColumns: [
      'id',
      'tecnica_variante_id',
      'codigo',
      'codigo_curto',
      'codigo_tabela',
      'nome',
      'descricao',
      'grupo_tecnica',
      'nome_grupo',
      'cobra_por_cor',
      'max_cores',
      'desconto_segunda_cor',
      'desconto_terceira_cor',
      'desconto_quarta_cor_mais',
      'cobra_por_area',
      'area_maxima_cm2',
      'area_maxima_texto',
      'cobra_por_pontos',
      'max_pontos',
      'custo_setup',
      'custo_setup_por_cor',
      'tipo_setup',
      'custo_manuseio',
      'custo_manuseio_por_peca',
      'custo_aplicacao',
      'cobra_aplicacao',
      'custo_queima_forno',
      'cobra_queima_forno',
      'custo_termo_transferencia',
      'cobra_termo_transferencia',
      'faturamento_minimo',
      'quantidade_corte',
      'validade_inicio',
      'validade_fim',
      'ativo',
      'created_at',
      'updated_at',
    ],
    consumers: [
      'src/hooks/useMockupGenerator.ts',
      'src/hooks/tecnicas/useTecnicasList.ts',
      'src/lib/fetch-print-areas.ts',
      'src/types/gravacao-database.ts (TabelaPrecoOficial)',
      'src/hooks/gravacao/gravacao-types.ts (TabelaPrecoOficial)',
    ],
  },
  {
    table: 'tabela_preco_gravacao_oficial_faixa',
    expectedColumns: [
      'id',
      'tabela_preco_gravacao_id',
      'quantidade_minima',
      'quantidade_maxima',
      'preco_unitario',
      'prazo_dias',
      'ordem',
      'largura_min',
      'largura_max',
      'altura_min',
      'altura_max',
      'created_at',
      'updated_at',
    ],
    consumers: [
      'src/components/products/customization/ConfigurationPanel.tsx',
      'src/types/gravacao-database.ts (FaixaPrecoOficial)',
      'src/hooks/gravacao/gravacao-types.ts (FaixaPrecoOficial)',
    ],
  },
  {
    table: 'print_area_techniques',
    expectedColumns: [
      'id',
      'product_id',
      'tabela_preco_id',
      'location_code',
      'location_name',
      'location_order',
      'max_width',
      'max_height',
      'is_curved',
      'shape',
      'technique_order',
      'is_active',
      'notes',
      'unit_cost',
      'created_at',
      'updated_at',
    ],
    consumers: [
      'src/components/admin/products/sections/engraving/useEngravingWizard.ts',
      'src/components/admin/products/sections/engraving/types.ts (PrintAreaTechnique)',
      'src/lib/fetch-print-areas.ts (PrintAreaFromProduct)',
    ],
  },
  {
    table: 'tecnica_gravacao',
    expectedColumns: [
      'id',
      'codigo',
      'codigo_interno',
      'nome',
      'descricao',
      'permite_cores',
      'max_cores',
      'cobra_por_cor',
      'cobra_por_area',
      'cobra_por_pontos',
      'requer_setup',
      'tipo_setup',
      'tempo_producao_dias',
      'ordem_exibicao',
      'ativo',
      'slug',
      'created_at',
      'updated_at',
    ],
    consumers: [
      'src/hooks/tecnicas/useTecnicasList.ts',
      'src/components/admin/products/sections/engraving/useEngravingWizard.ts (ExternalTechnique)',
      'src/types/gravacao-database.ts (TecnicaGravacao)',
    ],
  },
];

export interface TableDiff {
  table: string;
  exists: boolean;
  error?: string;
  expectedColumns: string[];
  actualColumns: string[];
  missingInDb: string[]; // front espera, banco não tem -> BREAKING
  newInDb: string[]; // banco tem, front não usa -> oportunidade
  consumers: string[];
}

export function diffColumns(
  expected: string[],
  actual: string[],
): {
  missingInDb: string[];
  newInDb: string[];
} {
  const exp = new Set(expected);
  const act = new Set(actual);
  return {
    missingInDb: expected.filter((c) => !act.has(c)),
    newInDb: actual.filter((c) => !exp.has(c)),
  };
}

export function buildMarkdownReport(diffs: TableDiff[]): string {
  const lines: string[] = [];
  lines.push('# Diff de schema — Tabelas de Gravação');
  lines.push('');
  lines.push(`Gerado em ${new Date().toISOString()}`);
  lines.push('');
  for (const d of diffs) {
    lines.push(`## \`${d.table}\``);
    if (!d.exists) {
      lines.push(`- ❌ **Tabela não acessível**: ${d.error || 'erro desconhecido'}`);
      lines.push('');
      continue;
    }
    lines.push(`- Colunas esperadas (front): **${d.expectedColumns.length}**`);
    lines.push(`- Colunas reais (banco): **${d.actualColumns.length}**`);
    lines.push('');
    lines.push('### 🔴 Faltando no banco (BREAKING — front lê)');
    lines.push(
      d.missingInDb.length ? d.missingInDb.map((c) => `- \`${c}\``).join('\n') : '_nenhuma_',
    );
    lines.push('');
    lines.push('### 🟢 Novas no banco (oportunidade)');
    lines.push(d.newInDb.length ? d.newInDb.map((c) => `- \`${c}\``).join('\n') : '_nenhuma_');
    lines.push('');
    lines.push('### Consumidores no front');
    lines.push(d.consumers.map((c) => `- \`${c}\``).join('\n'));
    lines.push('');
  }
  return lines.join('\n');
}
