#!/usr/bin/env node
/**
 * Auditoria estática (AST) do bloco Frete em QuoteBuilderPage.tsx.
 *
 * Valida:
 *  (1) <div>s balanceados dentro do bloco Frete.
 *  (2) data-testid esperados aparecem exatamente 1x:
 *      freight-grid, freight-grid-col-1, freight-grid-col-2,
 *      shipping-type-select, shipping-cost-input.
 *  (3) Nenhum <Label> fora de célula do grid.
 *  (4) `space-y-*` não aplicado ao container do grid (só nas células).
 *  (5) `items-end` presente no grid.
 *  (6) Todo htmlFor resolve para um id declarado no mesmo bloco.
 *
 * Falha com exit 1 se qualquer invariante for violada.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default ?? traverseModule;
const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, '../../src/pages/quotes/QuoteBuilderPage.tsx');
const src = readFileSync(FILE, 'utf8');

const errors = [];
const push = (msg) => errors.push(msg);

// (1) Balanço textual do bloco Frete
const start = src.indexOf('{/* Frete */}');
if (start < 0) push('Marcador `{/* Frete */}` não encontrado em QuoteBuilderPage.tsx');
const end = src.indexOf('{s.companyInfo?.id', start);
if (end < 0) push('Não achei o próximo irmão do bloco Frete (`{s.companyInfo?.id`)');
const bloco = src.slice(start, end);
const opens = (bloco.match(/<div\b/g) ?? []).length;
const closes = (bloco.match(/<\/div>/g) ?? []).length;
if (opens !== closes) push(`<div> desbalanceados no bloco Frete: ${opens} abre × ${closes} fecha`);

// (2) data-testid únicos
const EXPECTED_TESTIDS = [
  'freight-grid',
  'freight-grid-col-1',
  'freight-grid-col-2',
  'shipping-type-select',
  'shipping-cost-input',
];
for (const tid of EXPECTED_TESTIDS) {
  const re = new RegExp(`data-testid="${tid}"`, 'g');
  const n = (bloco.match(re) ?? []).length;
  if (n !== 1) push(`data-testid="${tid}" deveria aparecer 1x no bloco Frete, encontrou ${n}`);
}

// (5) items-end no grid
if (!/grid grid-cols-1 md:grid-cols-3[^"]*items-end/.test(bloco)) {
  push('Grid do Frete não tem items-end (perde alinhamento do input com o trigger)');
}

// (4) space-y-* NÃO no grid
const gridClassMatch = bloco.match(/<div\s+className="([^"]*grid-cols-1 md:grid-cols-3[^"]*)"/);
if (gridClassMatch && /\bspace-y-/.test(gridClassMatch[1])) {
  push(`Grid do Frete não pode ter space-y-*: "${gridClassMatch[1]}"`);
}

// AST-based (3) + (6)
const ast = parse(src, {
  sourceType: 'module',
  plugins: ['typescript', 'jsx'],
  errorRecovery: true,
});

const gridColTestids = new Set(['freight-grid-col-1', 'freight-grid-col-2']);
const idsDeclarados = new Set();
const htmlForRefs = [];

function jsxAttr(node, name) {
  return node.openingElement?.attributes?.find(
    (a) => a.type === 'JSXAttribute' && a.name.name === name,
  );
}
function attrLiteral(attr) {
  if (!attr) return null;
  if (attr.value?.type === 'StringLiteral') return attr.value.value;
  if (attr.value?.type === 'JSXExpressionContainer' && attr.value.expression.type === 'StringLiteral')
    return attr.value.expression.value;
  return null;
}
function isInsideFreteBlock(nodeStart) {
  return nodeStart >= start && nodeStart <= end;
}
function ancestorIsGridCol(path) {
  let p = path.parentPath;
  while (p) {
    if (p.isJSXElement()) {
      const tid = attrLiteral(jsxAttr(p.node, 'data-testid'));
      if (tid && gridColTestids.has(tid)) return true;
    }
    p = p.parentPath;
  }
  return false;
}

traverse(ast, {
  JSXOpeningElement(path) {
    if (!isInsideFreteBlock(path.node.start ?? -1)) return;
    const idAttr = attrLiteral(jsxAttr(path.parent, 'id'));
    if (idAttr) idsDeclarados.add(idAttr);
  },
  JSXElement(path) {
    if (!isInsideFreteBlock(path.node.start ?? -1)) return;
    const name = path.node.openingElement.name;
    const localName = name.type === 'JSXIdentifier' ? name.name : null;
    if (!localName) return;

    // (3) <Label> deve estar dentro de uma célula do grid.
    if (localName === 'Label') {
      if (!ancestorIsGridCol(path)) {
        push(`<Label> fora de célula do grid (line ~${path.node.loc?.start.line})`);
      }
    }

    // (6) coletar htmlFor + id
    const htmlFor = attrLiteral(jsxAttr(path.node, 'htmlFor'));
    if (htmlFor) htmlForRefs.push({ id: htmlFor, line: path.node.loc?.start.line });
    const idAttr = attrLiteral(jsxAttr(path.node, 'id'));
    if (idAttr) idsDeclarados.add(idAttr);
  },
});

for (const ref of htmlForRefs) {
  if (!idsDeclarados.has(ref.id)) {
    push(`htmlFor="${ref.id}" (linha ${ref.line}) sem <input>/<trigger> com id correspondente`);
  }
}

// Report
if (errors.length === 0) {
  console.log('✅ Bloco Frete: 6/6 invariantes AST verdes');
  console.log(`   • <div> balanceados: ${opens}/${closes}`);
  console.log(`   • testids únicos: ${EXPECTED_TESTIDS.join(', ')}`);
  console.log(`   • htmlFor→id resolvidos: ${htmlForRefs.length}`);
  process.exit(0);
} else {
  console.error('❌ Bloco Frete: violações encontradas');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
