/**
 * Regressão: `TemplateThumbnail` foi deletado do repositório em decisão
 * consciente (PO removeu miniatura do hero + DesignStep para eliminar
 * duplicidade com a PreviewSidebar). Este teste falha se alguém restaurar
 * o arquivo ou reintroduzir imports por engano.
 *
 * Sem dependências externas: usa apenas `node:fs`.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const projectRoot = resolve(__dirname, '..', '..', '..', '..', '..');
const srcRoot = resolve(projectRoot, 'src');
const removedFile = resolve(
  projectRoot,
  'src/pages/magazine/components/TemplateThumbnail.tsx',
);

const SELF_REFERENCES: readonly string[] = [
  'no-template-thumbnail.test.ts',
  'DesignStep.test.tsx',
  'EditorHero.test.tsx',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      walk(abs, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !SELF_REFERENCES.includes(entry)) {
      out.push(abs);
    }
  }
  return out;
}

describe('regressão: TemplateThumbnail removido', () => {
  it('o arquivo TemplateThumbnail.tsx não deve existir', () => {
    expect(existsSync(removedFile)).toBe(false);
  });

  it('nenhum arquivo em src/ importa TemplateThumbnail', () => {
    const files = walk(srcRoot);
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (/from\s+['"][^'"]*TemplateThumbnail['"]/.test(content)) {
        offenders.push(file);
      }
    }
    expect(
      offenders,
      `imports remanescentes de TemplateThumbnail:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
