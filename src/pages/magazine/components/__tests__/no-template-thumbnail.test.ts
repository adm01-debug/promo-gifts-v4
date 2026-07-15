/**
 * Regressão: `TemplateThumbnail` foi deletado do repositório em decisão
 * consciente (PO removeu miniatura do hero + DesignStep para eliminar
 * duplicidade com a PreviewSidebar). Este teste falha se alguém restaurar
 * o arquivo ou reintroduzir imports por engano.
 */

import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fg from 'fast-glob';

const projectRoot = resolve(__dirname, '..', '..', '..', '..', '..');
const removedFile = resolve(
  projectRoot,
  'src/pages/magazine/components/TemplateThumbnail.tsx',
);

describe('regressão: TemplateThumbnail removido', () => {
  it('o arquivo TemplateThumbnail.tsx não deve existir', () => {
    expect(existsSync(removedFile)).toBe(false);
  });

  it('nenhum arquivo em src/ importa TemplateThumbnail', async () => {
    const files = await fg(['src/**/*.{ts,tsx}'], {
      cwd: projectRoot,
      absolute: true,
      ignore: [
        // O próprio teste referencia o nome como string — não é import.
        '**/__tests__/no-template-thumbnail.test.ts',
        // O teste do DesignStep também menciona o nome nos comentários.
        '**/__tests__/DesignStep.test.tsx',
        '**/__tests__/EditorHero.test.tsx',
      ],
    });

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
