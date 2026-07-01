#!/usr/bin/env node
/**
 * map-drafts-to-migrations.mjs
 *
 * Gera uma tabela relacionando cada arquivo em `qa/migrations-draft/` a:
 *   1. Migration(s) correspondente(s) em `supabase/migrations/` (por slug)
 *   2. Status de aplicação no banco canônico (via
 *      `supabase_migrations.schema_migrations`), quando acessível
 *
 * Saída: `qa/migrations-draft/DRAFTS_STATUS.md` (regravado a cada execução).
 *
 * Uso:
 *   node scripts/map-drafts-to-migrations.mjs           # regenera
 *   node scripts/map-drafts-to-migrations.mjs --check   # exit != 0 se stale
 *
 * Requisitos:
 *   • Sempre: node + fs (leitura de diretórios).
 *   • Opcional para status no DB: `psql` + PGHOST/PG* configurados (aponta
 *     para o pooler do projeto canônico). Sem PG, a coluna "Aplicada no DB"
 *     vira `sem acesso ao DB`.
 *
 * Matching:
 *   • Slug do draft = tudo após o primeiro `_`, sem extensão (`.sql`).
 *   • Migration candidata em supabase/migrations/ = arquivo cujo nome contenha
 *     o slug do draft OU pelo menos 60% dos tokens do slug (≥3 chars).
 */

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = process.cwd();
const DRAFT_DIR = join(ROOT, 'qa', 'migrations-draft');
const MIG_DIR = join(ROOT, 'supabase', 'migrations');
const OUT = join(DRAFT_DIR, 'DRAFTS_STATUS.md');
const REVIEWS = join(DRAFT_DIR, 'REVIEWS.json');

const check = process.argv.includes('--check');

function loadAcknowledged() {
  if (!existsSync(REVIEWS)) return new Set();
  try {
    const data = JSON.parse(readFileSync(REVIEWS, 'utf8'));
    const list = Array.isArray(data?.acknowledged_not_promoted)
      ? data.acknowledged_not_promoted
      : [];
    return new Set(list.map((e) => (typeof e === 'string' ? e : e?.draft)).filter(Boolean));
  } catch (e) {
    console.error(`[drafts-map] REVIEWS.json inválido: ${e.message}`);
    process.exit(2);
  }
}

function slugOf(file) {
  // "2026-06-27_quotes_status_allow_cancelled.sql" -> "quotes_status_allow_cancelled"
  const base = basename(file, '.sql');
  const idx = base.indexOf('_');
  return idx < 0 ? base : base.slice(idx + 1);
}

function tokensOf(slug) {
  return slug.split(/[_.-]+/).filter((t) => t.length >= 3);
}

function findCandidates(slug, migFiles) {
  const wanted = tokensOf(slug);
  const wantedLc = wanted.map((t) => t.toLowerCase());
  const scored = [];
  for (const f of migFiles) {
    const nameLc = f.toLowerCase();

    // Match exato do slug inteiro → 100%, todos os tokens contam como hit.
    if (nameLc.includes(slug.toLowerCase())) {
      scored.push({
        file: f,
        score: 1.0,
        matchType: 'slug-exato',
        matchedTokens: [...wanted],
        missingTokens: [],
      });
      continue;
    }

    // Fuzzy por tokens: quais tokens do slug aparecem no nome do arquivo canônico.
    const matched = [];
    const missing = [];
    wantedLc.forEach((t, i) => {
      if (nameLc.includes(t)) matched.push(wanted[i]);
      else missing.push(wanted[i]);
    });
    const ratio = wanted.length ? matched.length / wanted.length : 0;
    if (ratio >= 0.6 && matched.length >= Math.min(3, wanted.length)) {
      scored.push({
        file: f,
        score: ratio,
        matchType: 'tokens',
        matchedTokens: matched,
        missingTokens: missing,
      });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
  return scored.slice(0, 3); // no máximo 3 candidatos por draft
}

function fetchAppliedVersions() {
  if (!process.env.PGHOST) return { ok: false, reason: 'PGHOST ausente', set: new Set() };
  try {
    const out = execSync(
      `psql -tAX -c "SELECT version FROM supabase_migrations.schema_migrations"`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const set = new Set(
      out.split('\n').map((l) => l.trim()).filter(Boolean),
    );
    return { ok: true, set };
  } catch (e) {
    const msg = String(e.stderr || e.message || e).split('\n')[0].slice(0, 120);
    return { ok: false, reason: msg, set: new Set() };
  }
}

function versionOf(migFile) {
  // "20260627123045_quotes_status_allow_cancelled.sql" -> "20260627123045"
  const m = /^(\d{14})/.exec(migFile);
  return m ? m[1] : null;
}

function main() {
  if (!existsSync(DRAFT_DIR)) {
    console.error(`[drafts-map] diretório inexistente: ${DRAFT_DIR}`);
    process.exit(1);
  }
  const drafts = readdirSync(DRAFT_DIR).filter((f) => f.endsWith('.sql')).sort();
  const migFiles = readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql'));
  const applied = fetchAppliedVersions();

  const rows = drafts.map((draft) => {
    const slug = slugOf(draft);
    const allTokens = tokensOf(slug);
    const cands = findCandidates(slug, migFiles);

    let candidateCell = '—';
    let statusCell;

    if (cands.length === 0) {
      candidateCell = '_(nenhum match)_';
      statusCell = '🟡 não promovido';
    } else {
      candidateCell = cands
        .map((c) => {
          const pct = Math.round(c.score * 100);
          const badge = c.matchType === 'slug-exato' ? '🎯 slug exato' : `${pct}%`;
          const matched = c.matchedTokens.length
            ? c.matchedTokens.map((t) => `\`${t}\``).join(' ')
            : '_(nenhum)_';
          const missing = c.missingTokens.length
            ? ` · faltou: ${c.missingTokens.map((t) => `~~\`${t}\`~~`).join(' ')}`
            : '';
          return (
            `\`${c.file}\` — **${badge}**<br>` +
            `&nbsp;&nbsp;↳ bateu: ${matched}${missing}`
          );
        })
        .join('<br><br>');
      if (!applied.ok) {
        statusCell = `❔ ${applied.reason}`;
      } else {
        const anyApplied = cands.some((c) => {
          const v = versionOf(c.file);
          return v && applied.set.has(v);
        });
        statusCell = anyApplied ? '✅ aplicada' : '🟠 versionada, não aplicada';
      }
    }

    return { draft, slug, tokens: allTokens, candidateCell, statusCell };
  });

  const generatedAt = new Date().toISOString();
  const body = [
    '# Rastreamento draft → migration → DB',
    '',
    `_Atualizado em ${generatedAt} · ${rows.length} rascunho(s) · ` +
      (applied.ok
        ? `${applied.set.size} versões aplicadas no DB canônico._`
        : `**sem acesso ao DB** (${applied.reason})._`),
    '',
    'Gerado por `scripts/map-drafts-to-migrations.mjs`. Não editar à mão.',
    '',
    '## Legenda',
    '',
    '- ✅ **aplicada** — existe migration versionada correspondente E o `version` está em `supabase_migrations.schema_migrations`.',
    '- 🟠 **versionada, não aplicada** — foi promovida para `supabase/migrations/` mas o DB canônico ainda não a executou.',
    '- 🟡 **não promovido** — só existe rascunho; nenhuma migration canônica bate com o slug.',
    '- ❔ **sem acesso ao DB** — status não pôde ser consultado (PG indisponível ou sem permissão).',
    '',
    '### Como ler a coluna "Candidatos"',
    '',
    '- **🎯 slug exato** — o nome do arquivo canônico contém o slug completo do draft (match 100%).',
    '- **N%** — fuzzy por tokens: `N = tokens do slug encontrados / total`. Só aparece se ≥ 60% e ≥ 3 tokens (ou todos, se slug tiver menos).',
    '- `token` — apareceu no nome do arquivo canônico.',
    '- ~~`token`~~ — está no slug do draft mas **não** no candidato (sinal de divergência semântica).',
    '',
    '## Tabela',
    '',
    '| Rascunho | Slug (tokens) | Candidatos em `supabase/migrations/` | Status no DB |',
    '| --- | --- | --- | --- |',
    ...rows.map((r) => {
      const tokensCell = r.tokens.length
        ? `\`${r.slug}\`<br>${r.tokens.map((t) => `\`${t}\``).join(' ')}`
        : `\`${r.slug}\``;
      return `| \`${r.draft}\` | ${tokensCell} | ${r.candidateCell} | ${r.statusCell} |`;
    }),
    '',
    '## Como agir',
    '',
    '- **🟡 não promovido** → revisar o rascunho e, quando aprovado, copiar para `supabase/migrations/<timestamp>_<slug>.sql` (ver `qa/migrations-draft/README.md`).',
    '- **🟠 versionada, não aplicada** → verificar por que o `db push` não rodou; pode ser drift real ou marker faltando em `schema_migrations`.',
    '- **✅ aplicada** → deletar o arquivo do `qa/migrations-draft/` (dupla verdade proibida).',
    '',
  ].join('\n');

  if (check) {
    // Compara ignorando o timestamp `_Atualizado em ..._`, senão --check
    // falha toda execução por causa da nova data.
    const stripTs = (s) =>
      s.replace(/_Atualizado em [^_·]+/g, '_Atualizado em <ts> ');
    const currentBody = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (stripTs(currentBody) !== stripTs(body)) {
      console.error('[drafts-map] DRAFTS_STATUS.md desatualizado. Rode: node scripts/map-drafts-to-migrations.mjs');
      process.exit(1);
    }

    // Gate de revisão: todo draft 🟡 "não promovido" precisa estar registrado
    // em qa/migrations-draft/REVIEWS.json (acknowledged_not_promoted).
    const ack = loadAcknowledged();
    const notPromoted = rows.filter((r) => r.statusCell.includes('não promovido')).map((r) => r.draft);
    const unreviewed = notPromoted.filter((d) => !ack.has(d));
    if (unreviewed.length > 0) {
      console.error('[drafts-map] Rascunhos 🟡 "não promovido" sem revisão registrada:');
      for (const d of unreviewed) console.error(`  - ${d}`);
      console.error(
        '\nAções:\n' +
          '  1) Promova via `npm run draft:promote -- <arquivo> --apply` OU\n' +
          '  2) Registre a revisão em qa/migrations-draft/REVIEWS.json adicionando:\n' +
          '     { "draft": "<arquivo>", "reviewer": "<nome>", "date": "YYYY-MM-DD", "reason": "<motivo>" }\n' +
          '     em `acknowledged_not_promoted`.',
      );
      process.exit(1);
    }

    // Também detecta ack órfão (draft foi promovido/removido mas ficou no ledger)
    const draftsPresent = new Set(rows.map((r) => r.draft));
    const orphanAck = [...ack].filter((d) => !draftsPresent.has(d));
    if (orphanAck.length > 0) {
      console.error('[drafts-map] REVIEWS.json contém entradas órfãs (rascunho não existe mais):');
      for (const d of orphanAck) console.error(`  - ${d}`);
      console.error('\nRemova a entrada correspondente de acknowledged_not_promoted.');
      process.exit(1);
    }

    console.log(`[drafts-map] DRAFTS_STATUS.md ok · ${notPromoted.length} 🟡 revisados.`);
    return;
  }


  writeFileSync(OUT, body);
  console.log(`[drafts-map] Gerado ${OUT} (${rows.length} rascunho(s)).`);
}

main();
