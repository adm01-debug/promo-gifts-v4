/**
 * Contrato: alinhamento vertical entre stepper de quantidade e "Total"
 * no popup do CartHeaderButton.
 *
 * Regras (todas asseguradas por classes do Tailwind — sem depender de layout
 * real do jsdom, que não calcula alturas):
 *
 * 1) A coluna da esquerda (imagem + stepper) e a coluna da direita
 *    (Unitário + Total) DEVEM usar `self-stretch` + `justify-between` para
 *    que "Unitário" fique no topo, e "Total" e o stepper fiquem grudados
 *    na base — o alinhamento vale em qualquer breakpoint, mesmo quando o
 *    nome do produto quebra em 2 linhas no mobile.
 *
 * 2) O bloco "Total" mantém tipografia consistente abaixo do "Unitário"
 *    destacado (usa a variante inline `flex-row items-baseline` do
 *    PriceLabel — label 8px, valor 11px tabular-nums).
 *
 * Se qualquer regra sumir do arquivo (ex.: regen do Lovable ou refactor
 * ruim), este teste falha antes de o layout quebrar em produção.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(
  resolve(__dirname, '../CartHeaderButton.tsx'),
  'utf-8',
);

describe('CartHeaderButton — alinhamento Total × stepper', () => {
  it('coluna da imagem+stepper usa self-stretch + justify-between', () => {
    // Regex tolerante à ordem das classes, mas exige todas as três.
    const leftColRegex =
      /className="[^"]*\bflex-shrink-0\b[^"]*\bflex-col\b[^"]*\bjustify-between\b[^"]*\bself-stretch\b[^"]*"/;
    expect(SOURCE).toMatch(leftColRegex);
  });

  it('coluna de preço usa self-stretch + justify-between (Unitário topo, Total base)', () => {
    const rightColRegex =
      /className="flex min-w-\[60px\] flex-col items-end justify-between self-stretch"/;
    expect(SOURCE).toMatch(rightColRegex);
  });

  it('bloco "Total" mantém tipografia inline consistente (label + valor tabular)', () => {
    // O PriceLabel do "Total" precisa continuar usando a variante flex-row
    // com items-baseline — é o que garante hierarquia visual sob o "Unitário".
    const totalBlockRegex =
      /label="Total"[\s\S]{0,200}className="flex-row items-baseline gap-1 space-y-0 text-\[10px\]"/;
    expect(SOURCE).toMatch(totalBlockRegex);
  });

  it('todos os itens do popup usam o mesmo layout (map único, sem branch alternativo)', () => {
    // Um único `.map(` renderiza os itens do carrinho ativo — se alguém
    // duplicar o render em outro branch com layout diferente, o teste avisa.
    const mapMatches = SOURCE.match(/cart\.items\.slice\(0,\s*5\)\.map\(/g);
    expect(mapMatches?.length ?? 0).toBe(1);
  });
});
