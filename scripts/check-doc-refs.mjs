#!/usr/bin/env node
/**
 * check-doc-refs — Valida referências `path/arquivo.ext:linha` em documentos
 * do repositório apontando para código-fonte real.
 *
 * Verifica que:
 *   - o arquivo referenciado existe no working tree;
 *   - a linha (ou intervalo `A-B`) referenciada existe no arquivo;
 *   - os intervalos são válidos (start ≤ end, end ≤ totalLines).
 *
 * Uso:
 *   node scripts/check-doc-refs.mjs docs/PERF_OPTIMIZATIONS.md [outro.md ...]
 *
 * Sai com código 0 quando tudo OK, 1 quando alguma referência é inválida,
 * 2 em erro de argumentos.
 *
 * Reconhece referências dentro de crases ou texto solto, formato:
 *   caminho/arquivo.ext            → só existência
 *   caminho/arquivo.ext:123        → linha 123
 *   caminho/arquivo.ext:123-145    → intervalo 123..145
 *
 * Ignora URLs (http/https), tokens sem extensão, e caminhos em blocos de
 * código exemplo (dentro de fences ``` … ```). Um caminho com "..." ou
 * placeholder em `<`/`{` também é ignorado.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = process.cwd();
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Uso: node scripts/check-doc-refs.mjs <arquivo.md> [arquivo.md ...]');
  process.exit(2);
}

// Referências que reconhecemos como caminhos de código-fonte.
// Aceita: letras, dígitos, `_`, `-`, `.`, `/`, `@`.
// Extensão obrigatória (2-5 chars alfanum) para reduzir falso positivo com
// nomes de comandos como "npm run".
const REF_REGEX = /(?<![\w/])([a-zA-Z0-9_@][a-zA-Z0-9_./@-]*\.[a-zA-Z0-9]{1,6})(?::(\d+)(?:-(\d+))?)?/g;

// Prefixos de caminho aceitos como "código-fonte real do repo".
// Referências que não começam por um destes prefixos são ignoradas
// (evita pegar coisas como `example.com`, `foo.bar`, etc.).
const ALLOWED_PREFIXES = [
  'src/',
  'scripts/',
  'supabase/',
  'docs/',
  'public/',
  'e2e/',
  'tests/',
  '.github/',
  'package.json',
  'package-lock.json',
  'tsconfig',
  'vite.config',
  'tailwind.config',
  'bundle-size-baseline.json',
  '.env',
];

function isAllowed(pathRef) {
  return ALLOWED_PREFIXES.some((p) => pathRef === p || pathRef.startsWith(p));
}

function countLines(absPath) {
  const buf = readFileSync(absPath);
  // Compatível com CRLF/LF: conta '\n' e soma 1 se não terminar em nova linha.
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 0x0a) n++;
  if (buf.length > 0 && buf[buf.length - 1] !== 0x0a) n++;
  return n;
}

/**
 * Remove blocos ``` … ``` do markdown para não validar caminhos de exemplo.
 * Preserva o resto das linhas (contagem de linha do doc não importa aqui).
 */
function stripCodeFences(md) {
  const out = [];
  let inFence = false;
  for (const line of md.split(/\r?\n/)) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) out.push(line);
  }
  return out.join('\n');
}

const errors = [];
const warnings = [];
let totalChecked = 0;

for (const docPath of args) {
  const abs = resolve(ROOT, docPath);
  if (!existsSync(abs)) {
    errors.push(`Documento não encontrado: ${docPath}`);
    continue;
  }
  const raw = readFileSync(abs, 'utf8');
  const cleaned = stripCodeFences(raw);

  const seen = new Set();
  for (const match of cleaned.matchAll(REF_REGEX)) {
    const [full, pathRef, startStr, endStr] = match;

    // Skip: URLs
    const before = cleaned.slice(Math.max(0, match.index - 8), match.index);
    if (/https?:\/\/$/.test(before) || /:\/\/$/.test(before)) continue;

    // Skip: placeholders
    if (pathRef.includes('...')) continue;

    // Skip: não é caminho reconhecido
    if (!isAllowed(pathRef)) continue;

    const key = `${pathRef}|${startStr ?? ''}|${endStr ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    totalChecked++;

    const target = resolve(ROOT, pathRef);
    if (!existsSync(target)) {
      errors.push(`${docPath} → ${full}: arquivo NÃO existe`);
      continue;
    }

    let st;
    try {
      st = statSync(target);
    } catch (err) {
      errors.push(`${docPath} → ${full}: erro ao ler (${err.message})`);
      continue;
    }
    if (!st.isFile()) {
      // Diretório referenciado com ponto no nome — só warning.
      warnings.push(`${docPath} → ${full}: é diretório, não arquivo`);
      continue;
    }

    if (!startStr) continue; // só existência exigida

    const start = Number(startStr);
    const end = endStr ? Number(endStr) : start;
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (start < 1 || end < start) {
      errors.push(`${docPath} → ${full}: intervalo inválido (${start}-${end})`);
      continue;
    }

    const total = countLines(target);
    if (end > total) {
      errors.push(
        `${docPath} → ${full}: linha ${end} não existe (${pathRef} tem ${total} linhas)`,
      );
    }
  }
}

// Relatório
console.log(`🔎 check-doc-refs — ${totalChecked} referência(s) verificada(s) em ${args.length} documento(s).`);
if (warnings.length > 0) {
  console.warn(`\n⚠️  ${warnings.length} aviso(s):`);
  for (const w of warnings) console.warn(`   ${w}`);
}
if (errors.length > 0) {
  console.error(`\n❌ ${errors.length} referência(s) inválida(s):`);
  for (const e of errors) console.error(`   ${e}`);
  console.error('\nAtualize o documento ou o código-fonte antes de commitar.');
  process.exit(1);
}
console.log('\n✅ Todas as referências apontam para arquivos e linhas existentes.');
process.exit(0);
