/**
 * Auditoria estática: nenhum call-site fora do SSOT pode enviar
 * CNPJ em payload de mutação (insert/update/upsert) sem passar por
 * assertPersistableCnpj / normalizeCnpj.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('CNPJ — call-sites audit', () => {
  it('não há payload cnpj: <expr crua> em insert/update/upsert', () => {
    const files = walk('src');
    const offenders: string[] = [];
    // Regex: dentro de janela contendo insert(/update(/upsert(, procura `cnpj: ident`
    // onde ident não é null/undefined nem passa por helpers SSOT.
    const mutFn = /\.(insert|update|upsert)\s*\(/;
    const badCnpj = /cnpj\s*:\s*([a-zA-Z_$][\w$.]*)/g;
    const ALLOW = new Set([
      'null', 'undefined',
      'persistableCnpj', 'normalizedCnpj', 'cnpjDigits',
    ]);
    const ALLOW_CALLS = /(assertPersistableCnpj|normalizeCnpj|cnpjOptionalSchema)/;

    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      if (!mutFn.test(src)) continue;
      // Divide em blocos ao redor de cada mut call (janela 400 chars)
      let m: RegExpExecArray | null;
      const re = new RegExp(mutFn.source, 'g');
      while ((m = re.exec(src)) !== null) {
        const start = m.index;
        const window = src.slice(start, start + 600);
        let bm: RegExpExecArray | null;
        badCnpj.lastIndex = 0;
        while ((bm = badCnpj.exec(window)) !== null) {
          const ident = bm[1];
          if (ALLOW.has(ident)) continue;
          // aceita se a expressão contiver helper SSOT no mesmo escopo
          const lineCtx = window.slice(Math.max(0, bm.index - 100), bm.index + 200);
          if (ALLOW_CALLS.test(lineCtx)) continue;
          offenders.push(`${f}: cnpj:${ident}`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
