#!/usr/bin/env node
/**
 * promote-draft-migration.mjs
 *
 * Promove um rascunho de `qa/migrations-draft/` para migração canônica em
 * `supabase/migrations/<timestamp>_<slug>.sql`.
 *
 * Uso:
 *   npm run draft:promote -- <arquivo-do-draft> [flags]
 *
 * Exemplo:
 *   npm run draft:promote -- 2026-06-27_quotes_status_allow_cancelled.sql
 *
 * Flags:
 *   --apply                Efetiva a promoção (por padrão é dry-run).
 *   --skip-validation      Pula a checagem obrigatória do `.VALIDATION.md`.
 *                          (Só use em rascunhos triviais.)
 *   --keep-draft           Mantém o arquivo em `qa/migrations-draft/`.
 *                          Padrão: remove após copiar (evita dupla verdade).
 *   --timestamp=<YYYYMMDDHHMMSS>
 *                          Força o timestamp (útil para testes/replay).
 *
 * Validações executadas (todas obrigatórias, exceto quando indicado):
 *   1. Rascunho existe e termina em `.sql`.
 *   2. Referencia o projeto canônico `doufsxqlfjyuvxuezpln`
 *      OU o cabeçalho comenta explicitamente que é DDL agnóstica.
 *   3. NÃO referencia `pqpdolkaeqlyzpdpbizo` (Lovable Cloud interno).
 *   4. `.VALIDATION.md` de mesmo prefixo existe (a menos que --skip-validation).
 *   5. Nome de destino ainda não existe em `supabase/migrations/`.
 *
 * Saída:
 *   Dry-run: imprime o plano e sai 0.
 *   --apply: copia SQL, remove draft (a menos que --keep-draft), imprime
 *            comandos para revisar/commitar.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = process.cwd();
const DRAFT_DIR = join(ROOT, 'qa', 'migrations-draft');
const MIG_DIR = join(ROOT, 'supabase', 'migrations');

const CANONICAL_REF = 'doufsxqlfjyuvxuezpln';
const FORBIDDEN_REF = 'pqpdolkaeqlyzpdpbizo';

const RED = '\x1b[31m'; const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m'; const CYAN = '\x1b[36m'; const DIM = '\x1b[2m'; const RESET = '\x1b[0m';

const log  = (m) => console.log(`${CYAN}[promote]${RESET} ${m}`);
const ok   = (m) => console.log(`${GREEN}[promote][ok]${RESET} ${m}`);
const warn = (m) => console.warn(`${YELLOW}[promote][warn]${RESET} ${m}`);
const err  = (m) => console.error(`${RED}[promote][err]${RESET} ${m}`);
const dim  = (m) => console.log(`${DIM}${m}${RESET}`);

function parseArgs() {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const flags = new Set(args.filter((a) => a.startsWith('--') && !a.includes('=')));
  const kv = Object.fromEntries(
    args.filter((a) => a.startsWith('--') && a.includes('='))
      .map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=')]; }),
  );
  return {
    file: positional[0],
    apply: flags.has('--apply'),
    skipValidation: flags.has('--skip-validation'),
    keepDraft: flags.has('--keep-draft'),
    timestamp: kv.timestamp,
  };
}

function usage(code = 1) {
  console.log(`
Uso: npm run draft:promote -- <arquivo-do-draft> [--apply] [--skip-validation] [--keep-draft] [--timestamp=YYYYMMDDHHMMSS]

Rascunhos disponíveis em qa/migrations-draft/:
${readdirSync(DRAFT_DIR).filter((f) => f.endsWith('.sql')).map((f) => `  • ${f}`).join('\n') || '  (nenhum)'}
`);
  process.exit(code);
}

function utcTimestamp(d = new Date()) {
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

function slugFromDraft(name) {
  const base = basename(name, '.sql');
  const i = base.indexOf('_');
  return i < 0 ? base : base.slice(i + 1);
}

function main() {
  const opts = parseArgs();
  if (!opts.file) usage(1);
  if (!existsSync(DRAFT_DIR)) { err(`Diretório inexistente: ${DRAFT_DIR}`); process.exit(1); }
  if (!existsSync(MIG_DIR)) mkdirSync(MIG_DIR, { recursive: true });

  const draftFile = basename(opts.file);
  const draftPath = join(DRAFT_DIR, draftFile);
  const validationPath = join(DRAFT_DIR, draftFile.replace(/\.sql$/, '.VALIDATION.md'));

  // ---- Validação 1: arquivo existe e é .sql ----
  if (!draftFile.endsWith('.sql')) { err('O arquivo do rascunho deve terminar em .sql'); process.exit(1); }
  if (!existsSync(draftPath)) { err(`Rascunho não encontrado: qa/migrations-draft/${draftFile}`); usage(1); }

  const sql = readFileSync(draftPath, 'utf8');

  // Corpo executável = linhas fora de comentários (--) para checagem de refs.
  const executableBody = sql
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('--'))
    .join('\n');

  // ---- Validação 2 e 3: referências de projeto ----
  const problems = [];
  if (executableBody.includes(FORBIDDEN_REF)) {
    problems.push(`referência PROIBIDA a \`${FORBIDDEN_REF}\` em código executável. Alvo deve ser \`${CANONICAL_REF}\`.`);
  }
  const mentionsCanonical = sql.includes(CANONICAL_REF);
  const agnosticMarker = /\bDDL\s+agn[oó]stica\b/i.test(sql);
  if (!mentionsCanonical && !agnosticMarker) {
    problems.push(
      `cabeçalho não menciona \`${CANONICAL_REF}\` nem declara "DDL agnóstica". Adicione uma linha de comentário explicitando o alvo.`,
    );
  }

  // ---- Validação 4: .VALIDATION.md ----
  const hasValidation = existsSync(validationPath);
  if (!hasValidation && !opts.skipValidation) {
    problems.push(
      `\`${basename(validationPath)}\` ausente. Descreva o roteiro de validação pós-aplicação ou rode com \`--skip-validation\`.`,
    );
  }

  // ---- Validação 5: destino disponível ----
  const timestamp = opts.timestamp || utcTimestamp();
  if (!/^\d{14}$/.test(timestamp)) {
    problems.push(`--timestamp inválido: "${timestamp}" (esperado YYYYMMDDHHMMSS UTC).`);
  }
  const slug = slugFromDraft(draftFile);
  const targetName = `${timestamp}_${slug}.sql`;
  const targetPath = join(MIG_DIR, targetName);
  if (existsSync(targetPath)) {
    problems.push(`destino já existe: supabase/migrations/${targetName}`);
  }

  // Colisão adicional: qualquer migration existente com o mesmo slug (independente do timestamp).
  const collision = readdirSync(MIG_DIR).find((f) => f.endsWith(`_${slug}.sql`));
  if (collision) {
    warn(`já existe migration com o mesmo slug: supabase/migrations/${collision}`);
    warn('  → confirme se o draft não é redundante antes de prosseguir.');
  }

  // ---- Relatório ----
  log(`Rascunho:      qa/migrations-draft/${draftFile}`);
  log(`Slug:          ${slug}`);
  log(`Timestamp:     ${timestamp} (UTC)`);
  log(`Destino:       supabase/migrations/${targetName}`);
  log(`Validation.md: ${hasValidation ? '✅ presente' : opts.skipValidation ? '⚠️  ausente (skip aceito)' : '❌ ausente'}`);
  log(`Alvo canônico: ${mentionsCanonical ? '✅ mencionado' : agnosticMarker ? 'ℹ️  DDL agnóstica' : '❌ não declarado'}`);

  if (problems.length) {
    err(`${problems.length} problema(s) impedem a promoção:`);
    for (const p of problems) err(`  • ${p}`);
    process.exit(1);
  }

  if (!opts.apply) {
    console.log('');
    warn('DRY-RUN. Nenhum arquivo foi escrito.');
    dim('Para efetivar, rode novamente com --apply:');
    dim(`  npm run draft:promote -- ${draftFile} --apply${opts.keepDraft ? ' --keep-draft' : ''}`);
    return;
  }

  // ---- Aplicação ----
  writeFileSync(targetPath, sql);
  ok(`Migration criada: supabase/migrations/${targetName}`);

  if (!opts.keepDraft) {
    unlinkSync(draftPath);
    ok(`Rascunho removido: qa/migrations-draft/${draftFile}`);
    if (hasValidation) {
      // .VALIDATION.md fica no draft dir como histórico? Melhor mover junto
      // para docs, mas por ora só avisa.
      warn(`\`${basename(validationPath)}\` foi mantido em qa/migrations-draft/ como histórico de validação.`);
    }
  } else {
    warn('Rascunho mantido em qa/migrations-draft/ (--keep-draft).');
  }

  console.log('');
  log('Próximos passos:');
  dim(`  1. Regenerar índice/status:`);
  dim(`       npm run drafts:list`);
  dim(`       npm run drafts:status   # opcional (requer PG)`);
  dim(`  2. Confirmar drift local (opcional):`);
  dim(`       supabase db diff --linked --schema public`);
  dim(`  3. Commit no PR: "feat(db): promote ${slug}"`);
  dim(`  4. Após merge, o deploy aplica via supabase db push.`);
}

try { main(); }
catch (e) { err(e.stack || e.message); process.exit(1); }
