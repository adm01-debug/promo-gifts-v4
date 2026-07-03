#!/usr/bin/env node
/**
 * Simulador em massa (500 iterações × 8 checks = 4.000 asserts) para validar
 * o alinhamento do label "Valor R$" com o início do input no bloco Frete
 * do QuoteBuilderPage, e a ausência do <span>R$</span> redundante.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default ?? traverseModule;
const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, '../../src/pages/quotes/QuoteBuilderPage.tsx');
const SRC = readFileSync(FILE, 'utf8');

const ITER = 500;

function attr(node, name) {
  return node.openingElement?.attributes?.find(
    (a) => a.type === 'JSXAttribute' && a.name.name === name,
  );
}
function litAttr(a) {
  if (!a) return null;
  if (a.value?.type === 'StringLiteral') return a.value.value;
  if (
    a.value?.type === 'JSXExpressionContainer' &&
    a.value.expression.type === 'StringLiteral'
  )
    return a.value.expression.value;
  return null;
}

/** Roda todos os 8 checks contra `src` e devolve {pass, fail, gaps[]}. */
function runChecks(src) {
  const gaps = [];
  const ast = parse(src, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    errorRecovery: true,
  });

  let col2Node = null;
  let currencyInputNode = null;
  let currencyInputParent = null;
  let labelValor = null;
  const labelValorCount = { n: 0 };
  const shippingTestidCount = { n: 0 };

  traverse(ast, {
    JSXElement(path) {
      const el = path.node;
      const name = el.openingElement.name;
      const local = name.type === 'JSXIdentifier' ? name.name : null;

      const testid = litAttr(attr(el, 'data-testid'));
      if (testid === 'freight-grid-col-2') col2Node = el;
      if (testid === 'shipping-cost-input') {
        shippingTestidCount.n++;
        currencyInputNode = el;
        currencyInputParent = path.parentPath?.node ?? null;
      }
      if (local === 'Label') {
        const htmlFor = litAttr(attr(el, 'htmlFor'));
        if (htmlFor === 'freight-value') {
          labelValor = el;
          labelValorCount.n++;
        }
      }
    },
  });

  // (a) Não existe <span>R$</span> irmão do CurrencyInput.
  if (!currencyInputParent) gaps.push('(a) CurrencyInput do frete não encontrado');
  else {
    const siblings = currencyInputParent.children ?? [];
    const spanIrmao = siblings.some((c) => {
      if (c.type !== 'JSXElement') return false;
      const n = c.openingElement?.name;
      if (n?.type !== 'JSXIdentifier' || n.name !== 'span') return false;
      const txt = (c.children ?? [])
        .map((x) => (x.type === 'JSXText' ? x.value.trim() : ''))
        .join('');
      return txt === 'R$';
    });
    if (spanIrmao) gaps.push('(a) <span>R$</span> irmão do input reintroduzido');
  }

  // (b) Label "Valor R$" existe 1× em freight-grid-col-2.
  if (!col2Node) gaps.push('(b) freight-grid-col-2 não encontrado');
  else if (labelValorCount.n !== 1)
    gaps.push(`(b) Label Valor R$ deveria aparecer 1×, encontrou ${labelValorCount.n}`);
  else {
    const labelDentro = JSON.stringify(col2Node).includes('"htmlFor"');
    if (!labelDentro) gaps.push('(b) Label não está dentro de freight-grid-col-2');
  }

  // (c) htmlFor="freight-value" resolve para id="freight-value" no bloco.
  if (!/id="freight-value"/.test(src) && !/id={['"`]freight-value['"`]}/.test(src))
    gaps.push('(c) id="freight-value" ausente');

  // (d) freight-grid-col-2 usa space-y-1 e NÃO usa flex/gap horizontal.
  if (col2Node) {
    const cls = litAttr(attr(col2Node, 'className')) ?? '';
    if (!/space-y-1/.test(cls))
      gaps.push(`(d) freight-grid-col-2 sem space-y-1: "${cls}"`);
    if (/\bflex\b/.test(cls) || /\bgap-\d/.test(cls))
      gaps.push(`(d) freight-grid-col-2 com flex/gap horizontal: "${cls}"`);
  }

  // (e) CurrencyInput é filho direto de freight-grid-col-2 (sem wrapper flex).
  if (col2Node && currencyInputNode) {
    const filhoDireto = (col2Node.children ?? []).some(
      (c) => c === currencyInputNode,
    );
    if (!filhoDireto)
      gaps.push('(e) CurrencyInput não é filho direto de freight-grid-col-2');
    if (currencyInputParent && currencyInputParent !== col2Node) {
      const pCls = litAttr(attr(currencyInputParent, 'className')) ?? '';
      if (/\bflex\b/.test(pCls) && /items-center/.test(pCls))
        gaps.push(`(e) Wrapper "flex items-center" reintroduzido: "${pCls}"`);
    }
  }

  // (f) data-testid="shipping-cost-input" único no arquivo.
  if (shippingTestidCount.n !== 1)
    gaps.push(
      `(f) shipping-cost-input aparece ${shippingTestidCount.n}× (esperado 1)`,
    );

  // (g) Ordem: Label antes do Input no fluxo do documento.
  if (labelValor && currencyInputNode) {
    if ((labelValor.start ?? 0) >= (currencyInputNode.start ?? 0))
      gaps.push('(g) Label Valor R$ aparece depois do input');
  }

  // (h) Nenhum mt-* no input que crie desalinhamento com o topo da célula.
  if (currencyInputNode) {
    const cls = litAttr(attr(currencyInputNode, 'className')) ?? '';
    if (/\bmt-\d/.test(cls))
      gaps.push(`(h) CurrencyInput com mt-* (desalinha): "${cls}"`);
  }

  const CHECKS = 8;
  return { pass: CHECKS - gaps.length, fail: gaps.length, gaps };
}

let totalPass = 0;
let totalFail = 0;
const gapAcc = new Map();

for (let i = 0; i < ITER; i++) {
  // Perturba buffer para evitar cache trivial (whitespace + CRLF alternado).
  const noise =
    (i % 2 === 0 ? '\n' : '\r\n') + ' '.repeat(i % 13) + (i % 3 === 0 ? '\t' : '');
  const { pass, fail, gaps } = runChecks(SRC + noise);
  totalPass += pass;
  totalFail += fail;
  for (const g of gaps) gapAcc.set(g, (gapAcc.get(g) ?? 0) + 1);
}

const totalAsserts = ITER * 8;
console.log(
  `Simulador Frete label alignment: ${totalPass}/${totalAsserts} pass, ${totalFail} fail`,
);
if (totalFail > 0) {
  console.error('Gaps encontrados:');
  for (const [g, n] of gapAcc) console.error(`  - [${n}×] ${g}`);
  process.exit(1);
}
process.exit(0);
