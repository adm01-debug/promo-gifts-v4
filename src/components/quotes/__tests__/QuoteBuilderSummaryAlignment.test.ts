/**
 * Invariantes de alinhamento vertical da linha de ações (Editar/Excluir/Colapsar)
 * com o nome do produto em QuoteBuilderSummaryColumn.
 *
 * Lock estrutural via leitura do source — barato, determinístico e resiliente
 * a viewports (375/768/1440/1920), pois valida tokens Tailwind, não pixels renderizados.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../QuoteBuilderSummaryColumn.tsx'),
  'utf8',
);

describe('QuoteBuilderSummaryColumn — alinhamento vertical dos botões', () => {
  it('nome do produto usa leading-[1.125rem] (line-height alvo)', () => {
    expect(SRC).toMatch(
      /<p className="truncate pr-1 text-sm font-medium leading-\[1\.125rem\]">/,
    );
  });

  it('nome aplica pr-1 para evitar sobreposição com a coluna de ações', () => {
    expect(SRC).toMatch(/truncate pr-1 text-sm/);
  });

  it('container dos 03 botões tem altura = line-height do nome e items-center', () => {
    expect(SRC).toMatch(
      /<div className="flex h-\[1\.125rem\] shrink-0 items-center gap-0\.5">/,
    );
  });

  it('não restou pt-0.5 / items-start no container de ações (regressão visual)', () => {
    expect(SRC).not.toMatch(/items-start gap-0\.5 pt-0\.5/);
  });

  it('cada botão preserva alvo de toque ≥32px via pseudo-elemento (inset -10px sobre 12px)', () => {
    const occurrences = SRC.match(
      /before:absolute before:inset-\[-10px\] before:content-/g,
    );
    expect(occurrences?.length).toBe(3);
  });

  it('botões mantêm tamanho compacto h-3 w-3 (12px) consistente em todos viewports', () => {
    const compact = SRC.match(/h-3 w-3 rounded-sm/g);
    expect(compact?.length).toBe(3);
  });

  it('cada botão tem tooltip comercial em PT-BR', () => {
    expect(SRC).toMatch(/>Ajustar este item</);
    expect(SRC).toMatch(/>Remover do orçamento</);
    // toggle expand/recolher
    expect(SRC).toMatch(/aria-label=\{isCollapsed \? 'Expandir' : 'Recolher'\}/);
  });
});
