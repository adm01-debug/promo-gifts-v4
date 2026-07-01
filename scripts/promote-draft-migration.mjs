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
 *   --pr                   Após --apply, cria branch `promote/<slug>-<ts>`,
 *                          regenera índice/status, commita, faz push e abre
 *                          um PR pronto para revisão via `gh pr create`.
 *                          Requer: `git` limpo + `gh` autenticado + remoto
 *                          `origin` configurado.
 *   --base=<branch>        Branch alvo do PR (default: `main`).
 *   --draft-pr             Abre o PR como draft (para review antecipada).
 *   --labels=<a,b,c>       Labels adicionais no PR (sempre inclui `db-migration`).
 *   --reviewers=<a,b>      Usuários/times para `gh pr create --reviewer`.
 *   --assignees=<a,b>      Usuários para `gh pr create --assignee`.
 *   --skip-db-diff         Não anexa `supabase db diff --linked` como comentário.
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
 *   --apply --pr: além do acima, cria branch, commita, push e abre PR.
 */

import { execSync } from 'node:child_process';
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
  const csv = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);
  return {
    file: positional[0],
    apply: flags.has('--apply'),
    skipValidation: flags.has('--skip-validation'),
    keepDraft: flags.has('--keep-draft'),
    timestamp: kv.timestamp,
    pr: flags.has('--pr'),
    draftPr: flags.has('--draft-pr'),
    base: kv.base || 'main',
    labels: Array.from(new Set(['db-migration', ...csv(kv.labels ?? kv.label)])),
    reviewers: csv(kv.reviewers ?? kv.reviewer),
    assignees: csv(kv.assignees ?? kv.assignee),
    skipDbDiff: flags.has('--skip-db-diff'),
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

  if (opts.pr) {
    openPullRequest({
      slug,
      timestamp,
      targetName,
      draftFile,
      base: opts.base,
      draftPr: opts.draftPr,
      keepDraft: opts.keepDraft,
      hasValidation,
    });
    return;
  }

  log('Próximos passos:');
  dim(`  1. Regenerar índice/status:`);
  dim(`       npm run drafts:list`);
  dim(`       npm run drafts:status   # opcional (requer PG)`);
  dim(`  2. Confirmar drift local (opcional):`);
  dim(`       supabase db diff --linked --schema public`);
  dim(`  3. Commit no PR: "feat(db): promote ${slug}"`);
  dim(`  4. Após merge, o deploy aplica via supabase db push.`);
  dim(`  → Ou rode novamente com --pr para automatizar branch+commit+PR.`);
}

// ============================================================================
// Automação de PR (--pr)
// ============================================================================
function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: opts.pipe ? ['ignore', 'pipe', 'pipe'] : 'inherit', ...opts });
}

function shSafe(cmd) {
  try { return { ok: true, out: execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() }; }
  catch (e) { return { ok: false, out: String(e.stderr || e.stdout || e.message || '').trim() }; }
}

function preflightGit() {
  const problems = [];
  if (!shSafe('git rev-parse --is-inside-work-tree').ok) problems.push('não é um repositório git.');
  const gh = shSafe('gh --version');
  if (!gh.ok) problems.push('CLI `gh` (GitHub CLI) não encontrado no PATH.');
  else {
    const auth = shSafe('gh auth status');
    if (!auth.ok) problems.push('`gh` não autenticado. Rode `gh auth login`.');
  }
  if (!shSafe('git remote get-url origin').ok) problems.push('remoto `origin` não configurado.');
  return problems;
}

function openPullRequest({ slug, timestamp, targetName, draftFile, base, draftPr, keepDraft, hasValidation }) {
  log('Preparando PR de promoção…');

  const problems = preflightGit();
  if (problems.length) {
    err('Pré-requisitos ausentes para --pr:');
    for (const p of problems) err(`  • ${p}`);
    warn('A migration já foi copiada; finalize o PR manualmente:');
    dim(`  git checkout -b promote/${slug}-${timestamp}`);
    dim(`  git add supabase/migrations/${targetName} qa/migrations-draft/`);
    dim(`  git commit -m "feat(db): promote ${slug}"`);
    dim(`  git push -u origin promote/${slug}-${timestamp}`);
    process.exit(1);
  }

  // Regenera índice e status (não bloqueante — se falhar, apenas avisa).
  const listRes = shSafe('node scripts/list-migration-drafts.mjs');
  if (!listRes.ok) warn(`drafts:list falhou (${listRes.out.split('\n')[0]})`);
  const statusRes = shSafe('node scripts/map-drafts-to-migrations.mjs');
  if (!statusRes.ok) warn(`drafts:status falhou (${statusRes.out.split('\n')[0]})`);

  const branch = `promote/${slug}-${timestamp}`;
  const currentBranch = shSafe('git rev-parse --abbrev-ref HEAD').out;
  if (currentBranch === branch) {
    warn(`já estamos em ${branch}; reutilizando a branch.`);
  } else {
    // Cria nova branch a partir do estado atual (com os arquivos já alterados).
    const co = shSafe(`git checkout -b ${branch}`);
    if (!co.ok) {
      err(`Falha ao criar branch ${branch}: ${co.out.split('\n')[0]}`);
      process.exit(1);
    }
    ok(`Branch criada: ${branch}`);
  }

  // Stage explícito dos arquivos que a promoção toca.
  sh(`git add supabase/migrations/${targetName}`, { pipe: true });
  sh(`git add qa/migrations-draft/`, { pipe: true }); // draft removido + índice + status

  const staged = shSafe('git diff --cached --name-only').out;
  if (!staged) {
    err('Nada em staging — abortei o commit do PR.');
    process.exit(1);
  }

  const title = `feat(db): promote ${slug} (${timestamp})`;
  const body = buildPrBody({ slug, timestamp, targetName, draftFile, keepDraft, hasValidation, stagedFiles: staged });

  // Commit
  writeFileSync('.git/PROMOTE_COMMIT_MSG', `${title}\n\n${body}`);
  const commit = shSafe(`git commit -F .git/PROMOTE_COMMIT_MSG`);
  if (!commit.ok) {
    err(`Falha no commit: ${commit.out.split('\n')[0]}`);
    process.exit(1);
  }
  ok('Commit criado.');

  // Push
  const push = shSafe(`git push -u origin ${branch}`);
  if (!push.ok) {
    err(`Falha no push: ${push.out.split('\n')[0]}`);
    warn('PR não foi aberto. Corrija e rode `gh pr create` manualmente.');
    process.exit(1);
  }
  ok(`Push concluído para origin/${branch}.`);

  // gh pr create
  writeFileSync('.git/PROMOTE_PR_BODY.md', body);
  const draftFlag = draftPr ? '--draft ' : '';
  const create = shSafe(
    `gh pr create --base ${base} --head ${branch} --title ${JSON.stringify(title)} --body-file .git/PROMOTE_PR_BODY.md ${draftFlag}`.trim(),
  );
  if (!create.ok) {
    err(`gh pr create falhou: ${create.out.split('\n')[0]}`);
    dim('Abra manualmente:');
    dim(`  gh pr create --base ${base} --head ${branch} --title ${JSON.stringify(title)} --body-file .git/PROMOTE_PR_BODY.md`);
    process.exit(1);
  }
  const prUrl = create.out.split('\n').find((l) => l.startsWith('http')) || create.out;
  ok(`PR aberto${draftPr ? ' (draft)' : ''}: ${prUrl}`);
}

function buildPrBody({ slug, timestamp, targetName, draftFile, keepDraft, hasValidation, stagedFiles }) {
  return [
    `## Promoção de rascunho → migration canônica`,
    ``,
    `- **Slug:** \`${slug}\``,
    `- **Timestamp UTC:** \`${timestamp}\``,
    `- **Destino:** \`supabase/migrations/${targetName}\``,
    `- **Rascunho de origem:** \`qa/migrations-draft/${draftFile}\`${keepDraft ? ' _(mantido)_' : ' _(removido)_'}`,
    `- **`.VALIDATION.md`:** ${hasValidation ? '✅ presente' : '⚠️ ausente (promovido com `--skip-validation`)'}`,
    ``,
    `### Validações executadas pelo \`draft:promote\``,
    `- ✅ Alvo canônico declarado (\`doufsxqlfjyuvxuezpln\` ou DDL agnóstica)`,
    `- ✅ Sem referência a \`pqpdolkaeqlyzpdpbizo\` em código executável`,
    `- ✅ Destino livre em \`supabase/migrations/\``,
    ``,
    `### Arquivos em staging`,
    '```',
    stagedFiles,
    '```',
    ``,
    `### Checklist do revisor`,
    `- [ ] SQL revisado (compatibilidade + idempotência)`,
    `- [ ] Rodou \`supabase db diff --linked --schema public\` local sem drift inesperado`,
    `- [ ] Roteiro do \`.VALIDATION.md\` foi executado em staging`,
    `- [ ] \`npm run drafts:check\` + \`npm run drafts:status:check\` + \`npm run drafts:target:check\` verdes no CI`,
    ``,
    `### Após merge`,
    `O deploy aplica via \`supabase db push\`. Confirme com \`SELECT version FROM supabase_migrations.schema_migrations WHERE version = '${timestamp}';\`.`,
    ``,
    `---`,
    `_Gerado por \`scripts/promote-draft-migration.mjs --pr\`._`,
  ].join('\n');
}


try { main(); }
catch (e) { err(e.stack || e.message); process.exit(1); }
