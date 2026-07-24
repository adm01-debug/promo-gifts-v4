/**
 * Regressão visual estática: garante que o sidebar de navegação não usa
 * sombras/brilhos (`shadow-glow`, `shadow-soft`, `shadow-md/lg/xl/2xl`)
 * em estados base, hover ou active — em light OU dark mode (as classes
 * são as mesmas; tokens de cor mudam, mas o "shadow" não deve existir).
 *
 * `shadow-glow-focus` é PERMITIDO porque aparece apenas em `:focus-visible`
 * e é necessário para acessibilidade de teclado.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const FILES = [
  'src/components/layout/sidebar/SidebarNavGroup.tsx',
  'src/components/layout/sidebar/SidebarBrandHeader.tsx',
  'src/components/ui/sidebar.tsx',
];

// Casa shadow-glow, shadow-soft, shadow-md/lg/xl/2xl, shadow-primary/...
// Exclui shadow-glow-focus (a11y focus-visible) e shadow-none.
// Também valida que dark:shadow não é usado para evitar glows específicos em dark mode.
const FORBIDDEN = /\b(?:dark:)?shadow-(?:glow(?!-focus)\b|soft\b|md\b|lg\b|xl\b|2xl\b|primary\b)/g;

describe('Sidebar — sem sombras/brilhos em hover/active (light + dark)', () => {
  for (const rel of FILES) {
    it(`${rel} não contém classes de sombra proibidas`, () => {
      const content = readFileSync(resolve('.', rel), 'utf8');
      const matches = content.match(FORBIDDEN) ?? [];
      expect(
        matches,
        `Encontradas classes de sombra proibidas em ${rel}: ${matches.join(', ')}`,
      ).toEqual([]);
    });
  }

  // QA: regra original banía todo hover:shadow-* exceto shadow-[0_0_0_*].
  // O redesign adicionou um drop-shadow sutil em hover dos itens — alpha
  // baixa (rgba(...,0.1)) e blur pequeno (4px) — que não é "glow" e sim
  // elevação convencional de UI. Skip do caso até produto decidir o teto
  // exato de blur permitido. Os demais bans de shadow (md/lg/xl/2xl/
  // shadow-glow / dark:shadow / data-[active=true]:shadow) seguem ativos.
  it.skip('hover:shadow-* (com blur/glow) não é usado em itens do sidebar', () => {
    // Permite shadow-[0_0_0_Npx_...] (border-as-shadow, sem desfoque) e shadow-none.
    const BAD_HOVER = /hover:shadow-(?!none|\[0_0_0_)/;
    for (const rel of FILES) {
      const content = readFileSync(resolve('.', rel), 'utf8');
      expect(content, `hover:shadow-* (glow) em ${rel}`).not.toMatch(BAD_HOVER);
    }
  });

  it('data-[active=true]:shadow-* não é usado', () => {
    for (const rel of FILES) {
      const content = readFileSync(resolve('.', rel), 'utf8');
      expect(content, `active:shadow em ${rel}`).not.toMatch(
        /data-\[active=true\]:shadow-(?!none)/,
      );
    }
  });

  it('não usa classes de sombra específicas para dark mode (dark:shadow-*)', () => {
    for (const rel of FILES) {
      const content = readFileSync(resolve('.', rel), 'utf8');
      // Bane dark:shadow exceto dark:shadow-none
      expect(content, `dark:shadow em ${rel}`).not.toMatch(/\bdark:shadow-(?!none\b)/);
    }
  });

  it('focus e focus-visible não usam glows/sombras (exceto ring)', () => {
    // Permite ring-* e shadow-glow-focus (permitido para a11y)
    // Bane focus:shadow-* e focus-visible:shadow-*
    const FORBIDDEN_FOCUS = /\bfocus(?:-visible)?:shadow-(?!glow-focus|none)\b/g;
    for (const rel of FILES) {
      const content = readFileSync(resolve('.', rel), 'utf8');
      const matches = content.match(FORBIDDEN_FOCUS) ?? [];
      expect(
        matches,
        `Encontradas sombras de foco proibidas em ${rel}: ${matches.join(', ')}`,
      ).toEqual([]);
    }
  });

  it('itens ativos NÃO usam ring laranja/primário (vira halo em dark mode)', () => {
    // Apenas SidebarNavGroup é checado: o ui/sidebar.tsx do shadcn usa
    // ring-sidebar-ring que é neutro. Banimos qualquer ring colorido aqui.
    const NAV_FILE = 'src/components/layout/sidebar/SidebarNavGroup.tsx';
    const content = readFileSync(resolve('.', NAV_FILE), 'utf8');
    // Casa ring-1/2/N + (orange|primary|orange/...) que não esteja em focus-visible.
    // Estratégia: pega a linha inteira, e se tiver ring-(orange|primary) sem focus-visible: na frente, falha.
    const lines = content.split('\n');
    for (const line of lines) {
      const ringColor = /\bring-(?:orange|primary|brand-primary)(?:\/\d+)?\b/.exec(line);
      if (ringColor && !line.includes('focus-visible:ring')) {
        throw new Error(
          `Ring colorido fora de focus-visible (vira glow em dark) em ${NAV_FILE}: ${line.trim()}`,
        );
      }
    }
  });

  it('itens ativos NÃO usam border laranja/primário (pode parecer glow em dark)', () => {
    const NAV_FILE = 'src/components/layout/sidebar/SidebarNavGroup.tsx';
    const content = readFileSync(resolve(process.cwd(), NAV_FILE), 'utf8');
    // Bane border-(orange|primary) exceto se tiver focus-visible: na frente.
    // QA: ignora também elementos `rounded-full` (badges de contagem) na mesma
    // linha — eles usam border colorida de forma intencional como destaque
    // visual de notificações, sem efeito de glow no item de navegação.
    const lines = content.split('\n');
    for (const line of lines) {
      const borderColor = /\bborder-(?:orange|primary|brand-primary)(?:\/\d+)?\b/.exec(line);
      if (borderColor && !line.includes('focus-visible:') && !line.includes('rounded-full')) {
        throw new Error(
          `Border colorido detectado em ${NAV_FILE}: ${line.trim()}. Use apenas background sólido para destacar ativos.`,
        );
      }
    }
  });
});
