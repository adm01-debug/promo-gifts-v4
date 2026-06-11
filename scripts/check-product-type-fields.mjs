#!/usr/bin/env node
/**
 * check-product-type-fields.mjs
 *
 * Verifica que campos críticos do tipo Product estão presentes nos arquivos
 * de definição de tipos. Previne:
 *   - Remoção silenciosa durante conflito de merge (gap C2, 2026-06-11)
 *   - Renomeação silenciosa pelo Lovable (gap L3: price → sale_price)
 *
 * Uso: node scripts/check-product-type-fields.mjs
 * Retorna: 0 = OK, 1 = campos ausentes ou inconsistentes
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

// Arquivos onde o tipo Product ou seus campos podem estar definidos
const TYPE_FILES = [
  'src/types/product-catalog.ts',
  'src/integrations/supabase/types.ts',
  'src/types/index.ts',
  'src/types/products.ts',
  'src/types/catalog.ts',
].map(f => join(ROOT, f)).filter(existsSync);

if (TYPE_FILES.length === 0) {
  console.error('❌ Nenhum arquivo de tipos encontrado. Verifique os caminhos em check-product-type-fields.mjs.');
  process.exit(1);
}

// Campos críticos que DEVEM existir em pelo menos um dos arquivos de tipos
// Formato: { field, description, critical }
const REQUIRED_FIELDS = [
  {
    patterns: ['price', 'sale_price'],
    description: 'Campo de preço do produto',
    rule: 'AT_LEAST_ONE',
    critical: true,
    note: 'Lovable renomeou price→sale_price em 2026-06-11 causando 400s em produção',
  },
  {
    patterns: ['shortDescription'],
    description: 'Descrição curta do produto',
    rule: 'ALL',
    critical: true,
    note: 'Removido durante merge do PR #701 (commit f22e1e2)',
  },
  {
    patterns: ['category_id'],
    description: 'ID da categoria',
    rule: 'ALL',
    critical: true,
    note: 'Removido durante merge do PR #701 (commit f22e1e2)',
  },
  {
    patterns: ['category_name', 'category'],
    description: 'Nome da categoria',
    rule: 'AT_LEAST_ONE',
    critical: false,
    note: 'Pode aparecer como category_name ou category conforme contexto',
  },
];

// Lê todos os arquivos de tipo em um único blob para busca
const typeContents = TYPE_FILES.map(f => {
  const content = readFileSync(f, 'utf-8');
  return { file: f.replace(ROOT + '/', ''), content };
});

const allContent = typeContents.map(t => t.content).join('\n');

let errors = 0;
let warnings = 0;
const results = [];

console.log('🔍 Verificando campos críticos do tipo Product...\n');
console.log(`Arquivos analisados:`);
typeContents.forEach(t => console.log(`  - ${t.file}`));
console.log();

for (const field of REQUIRED_FIELDS) {
  const found = field.patterns.filter(p => {
    // Busca o campo como propriedade de tipo TypeScript
    // Exemplos: price: number, price?: number, "price": number, sale_price:
    const regex = new RegExp(`['"\\s]${p}['"\\s]?[?:]`, 'i');
    return regex.test(allContent);
  });

  const allPresent = found.length === field.patterns.length;
  const anyPresent = found.length > 0;

  let status;
  if (field.rule === 'ALL' && !allPresent) {
    status = '❌ AUSENTE';
    if (field.critical) errors++;
    else warnings++;
    results.push({ status, field, found });
  } else if (field.rule === 'AT_LEAST_ONE' && !anyPresent) {
    status = field.critical ? '❌ AUSENTE' : '⚠️  AVISO';
    if (field.critical) errors++;
    else warnings++;
    results.push({ status, field, found });
  } else {
    status = '✅ OK';
    results.push({ status, field, found });
  }

  const foundStr = found.length > 0 ? found.join(', ') : 'nenhum';
  console.log(`${status} ${field.description}`);
  console.log(`   Padrões buscados: ${field.patterns.join(', ')}`);
  console.log(`   Encontrados: ${foundStr}`);
  if (field.note && (status.includes('❌') || status.includes('⚠️'))) {
    console.log(`   📝 Nota: ${field.note}`);
  }
  console.log();
}

// Resumo
if (errors > 0) {
  console.error(`\n❌ ${errors} campo(s) crítico(s) ausente(s) nos tipos do Product.`);
  console.error('\nComo corrigir:');
  console.error('  1. Verifique o último commit que alterou src/types/ ou src/integrations/supabase/types.ts');
  console.error('  2. git log --oneline -10 -- src/types/ src/integrations/supabase/types.ts');
  console.error('  3. Restaure os campos ausentes ou investigue se houve rename intencional');
  console.error('\nCampos obrigatórios documentados em: CLAUDE.md#regra-2');
  process.exit(1);
} else if (warnings > 0) {
  console.warn(`\n⚠️  ${warnings} aviso(s). Campos opcionais ausentes — não é bloqueante.`);
  process.exit(0);
} else {
  console.log(`✅ Todos os campos críticos do Product type estão presentes.`);
  process.exit(0);
}
