#!/usr/bin/env node
/**
 * Guard: garante que `eslint.config.js` e JS valido e exporta uma config utilizavel.
 *
 * POR QUE ISSO EXISTE
 * -------------------
 * Em 06/07/2026 um comentario JSDoc no `eslint.config.js` passou a conter um glob do
 * tipo "src/components/(asterisco)(asterisco)/(asterisco)List(asterisco)". A sequencia
 * asterisco + barra FECHA o bloco de comentario. O resto do texto virou codigo solto e
 * o arquivo deixou de parsear:
 *
 *     SyntaxError: Unexpected token '*'
 *
 * Quando o config nao parseia, o ESLint nao roda — mas nada grita. O
 * `check-eslint-baseline.mjs` trata status != 0/1 como "erro de execucao" e sai com 2,
 * e os workflows morrem com uma stack de modulo ESM que ninguem associa a lint.
 * Resultado: o repositorio ficou 6 dias sem lint algum. A regra
 * `react-hooks/rules-of-hooks` — que estava configurada como `error` — nunca executou,
 * e um hook depois de um early-return foi para producao como React #310
 * ("Rendered more hooks than during the previous render"), derrubando o editor de
 * revistas em 100% das montagens.
 *
 * Um comentario derrubou o guard-rail. Este script existe para que isso falhe ALTO e
 * em menos de 1s, antes de qualquer outro passo de lint.
 *
 * Uso:
 *   node scripts/check-eslint-config-parses.mjs
 *   -> exit 0: config parseia e exporta um array de blocos nao vazio
 *   -> exit 1: config quebrado (imprime arquivo, linha:coluna e o trecho ofensor)
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, relative } from 'node:path';

const ROOT = process.cwd();
const CONFIG = resolve(ROOT, 'eslint.config.js');
const rel = (p) => relative(ROOT, p) || p;

/** Imprime o trecho ao redor da linha ofensora, com uma seta na coluna. */
function printContext(source, line, column) {
  const lines = source.split('\n');
  const from = Math.max(1, line - 3);
  const to = Math.min(lines.length, line + 2);
  console.error('');
  for (let i = from; i <= to; i++) {
    const hit = i === line;
    console.error(`${hit ? '  > ' : '    '}${String(i).padStart(5)} | ${lines[i - 1]}`);
    if (hit && Number.isInteger(column)) console.error(`${' '.repeat(12 + column)}^`);
  }
  console.error('');
}

/**
 * A linha que o acorn apontou e a armadilha conhecida? Ou seja: uma linha de comentario
 * (` * ...`) contendo um asterisco+barra que fecha o bloco no meio do texto.
 */
function isGlobClosingComment(source, line) {
  const text = source.split('\n')[line - 1] ?? '';
  const CLOSE = '*' + '/';
  const idx = text.indexOf(CLOSE);
  // Linha de continuacao de JSDoc, com um fechamento no MEIO (nao no fim) -> armadilha.
  return /^\s*\*/.test(text) && idx !== -1 && text.slice(idx + 2).trim() !== '';
}

function fail(msg) {
  console.error('');
  console.error('  x eslint.config.js esta QUEBRADO — o ESLint nao vai rodar.');
  console.error('');
  console.error(`    ${msg}`);
  console.error('');
  console.error('    Sem lint, regras como react-hooks/rules-of-hooks param de');
  console.error('    executar em silencio e bugs de hook chegam em producao.');
  console.error('');
  process.exit(1);
}

let source;
try {
  source = readFileSync(CONFIG, 'utf8');
} catch {
  fail(`Arquivo nao encontrado: ${rel(CONFIG)}`);
}

// 1) Parse sintatico (rapido, e da linha:coluna exata).
try {
  const { parse } = await import('acorn');
  parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
} catch (err) {
  const line = err?.loc?.line;
  const column = err?.loc?.column;
  console.error('');
  console.error('  x eslint.config.js NAO E JAVASCRIPT VALIDO.');
  console.error('');
  console.error(`    ${rel(CONFIG)}${line ? `:${line}${column != null ? `:${column + 1}` : ''}` : ''}`);
  console.error(`    ${err.message}`);
  if (line) printContext(source, line, column);
  // O acorn ja apontou a linha exata: checa se ela e a armadilha conhecida.
  if (line && isGlobClosingComment(source, line)) {
    console.error('    CAUSA: um asterisco seguido de barra dentro de /* ... */ ENCERRA o');
    console.error('    comentario. A linha acima tem um glob com essa sequencia — o');
    console.error('    comentario fecha ali e o resto do texto vira codigo solto.');
    console.error('');
    console.error('    Reescreva o glob sem a sequencia (ex.: descreva em palavras).');
  }
  console.error('');
  console.error('    Sem lint, react-hooks/rules-of-hooks para de executar em silencio');
  console.error('    — foi assim que o React #310 chegou em producao.');
  console.error('');
  process.exit(1);
}

// 2) Carrega de fato e valida o shape (um array de blocos de config).
let mod;
try {
  mod = await import(`${pathToFileURL(CONFIG).href}?t=${Date.now()}`);
} catch (err) {
  fail(`Falhou ao importar a config: ${err.message}`);
}

const config = mod?.default;
if (!Array.isArray(config)) fail(`O export default deveria ser um array de blocos; veio: ${typeof config}`);
if (config.length === 0) fail('O export default e um array VAZIO — nenhuma regra seria aplicada.');

console.log(`  ok eslint.config.js — parseia e exporta ${config.length} blocos de config`);
