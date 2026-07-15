/**
 * Deliverable #4 — Gate de cores hardcoded no PDF.
 *
 * Escaneia todos os arquivos `.ts`/`.tsx` sob `src/components/pdf/`
 * (excluindo `__tests__/`) procurando literais hex (`#rgb`, `#rrggbb`,
 * `#rrggbbaa`). Cada literal encontrado precisa estar EM UMA das duas
 * fontes autorizadas:
 *
 *   1. `src/components/pdf/ProposalStyles.ts` — SSOT de tokens
 *      (`PDF_TOKENS`, `GREEN`, `GREEN_DARK`, `DARK`, `BLUE`).
 *   2. Baseline explícita em `qa/pdf-color-allowlist.json` — cores legadas
 *      já em uso que ainda não migraram para tokens.
 *
 * Qualquer NOVA cor fora dessas duas fontes reprova o teste. Isso impede
 * que novos literais entrem no PDF sem passar pela centralização.
 *
 * Regenerar baseline após refactor legítimo:
 *   UPDATE_PDF_COLOR_ALLOWLIST=1 npx vitest run pdfHardcodedColors
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const PDF_DIR = join(ROOT, 'src', 'components', 'pdf');
const ALLOWLIST_PATH = join(ROOT, 'qa', 'pdf-color-allowlist.json');
const TOKEN_FILE = join('src', 'components', 'pdf', 'ProposalStyles.ts');
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (name === '__tests__' || name === '__snapshots__') continue;
      walk(abs, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(abs);
    }
  }
  return out;
}

function normalizePath(abs: string): string {
  return relative(ROOT, abs).split(sep).join('/');
}

function extractColors(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const matches = src.match(HEX_RE) ?? [];
  return Array.from(new Set(matches.map((m) => m.toLowerCase()))).sort();
}

interface Allowlist {
  perFile: Record<string, string[]>;
}

describe('PDF — gate de cores hardcoded', () => {
  it('nenhuma cor nova fora de ProposalStyles.ts ou do allowlist', () => {
    const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) as Allowlist;
    const files = walk(PDF_DIR).map(normalizePath);

    const perFile: Record<string, string[]> = {};
    for (const f of files) {
      const colors = extractColors(join(ROOT, f));
      if (colors.length > 0) perFile[f] = colors;
    }

    if (process.env.UPDATE_PDF_COLOR_ALLOWLIST === '1') {
      const next = { ...allowlist, perFile };
      writeFileSync(ALLOWLIST_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      // eslint-disable-next-line no-console
      console.info('[pdfHardcodedColors] baseline regenerada em', ALLOWLIST_PATH);
      return;
    }

    const violations: string[] = [];
    for (const [file, colors] of Object.entries(perFile)) {
      if (file === TOKEN_FILE) continue; // SSOT — livre.
      const allowed = new Set(allowlist.perFile[file] ?? []);
      for (const c of colors) {
        if (!allowed.has(c)) violations.push(`${file} → ${c} (não está em ProposalStyles.ts nem no allowlist)`);
      }
    }

    // Também detecta arquivos NOVOS que introduzem cores sem baseline.
    for (const file of Object.keys(perFile)) {
      if (file === TOKEN_FILE) continue;
      if (!(file in allowlist.perFile)) {
        violations.push(`${file} — arquivo novo com cores hex; adicione ao allowlist ou migre para PDF_TOKENS`);
      }
    }

    expect(
      violations,
      `Cores hex fora do SSOT detectadas — centralize em ProposalStyles.ts ou rode UPDATE_PDF_COLOR_ALLOWLIST=1:\n  ${violations.join('\n  ')}`,
    ).toEqual([]);
  });

  it('ProposalStyles.ts continua sendo a única fonte de tokens declarada', () => {
    const src = readFileSync(join(ROOT, TOKEN_FILE), 'utf8');
    expect(src).toMatch(/export const PDF_TOKENS\s*=/);
    expect(src).toMatch(/export const GREEN\s*=/);
  });
});
