/**
 * Testes responsivos do ConfirmDialog em larguras 320/375/414/640/768/820/1024/1440.
 *
 * Como AlertDialog usa portal + fixed positioning, o "viewport" é simulado
 * via window.innerWidth/innerHeight. Validamos invariantes de layout:
 *   1) o conteúdo não estoura o viewport horizontalmente (respeita max-w).
 *   2) título e descrição permanecem no DOM (sem clipping via overflow:hidden na raiz de texto).
 *   3) ambos os botões (Cancelar/Confirmar) permanecem visíveis e alcançáveis.
 *   4) o accent bar de topo permanece renderizado em toda largura.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfirmDialog } from '../ConfirmDialog';

const WIDTHS = [320, 375, 414, 640, 768, 820, 1024, 1440] as const;

function setViewport(width: number, height = 900) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  window.dispatchEvent(new Event('resize'));
}

describe('ConfirmDialog — regressão responsiva (320 → 1440)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it.each(WIDTHS)('em %ipx: dialog renderiza sem estourar viewport e mantém título/descrição/botões', (width) => {
    setViewport(width);

    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Descartar alterações?"
        description="Você tem alterações não salvas neste item. Deseja realmente fechar e descartá-las?"
        confirmLabel="Descartar e fechar"
        confirmLabelShort="Descartar"
        cancelLabel="Continuar editando"
        cancelLabelShort="Continuar"
        onConfirm={() => {}}
        variant="destructive"
      />,
    );

    const dialog = screen.getByRole('alertdialog');

    expect(screen.getByText('Descartar alterações?')).toBeInTheDocument();
    expect(screen.getByText(/Você tem alterações não salvas neste item/i)).toBeInTheDocument();

    const yes = screen.getByTestId('confirm-dialog-yes');
    // Ambas variações (curta + longa) presentes no DOM — Tailwind decide via breakpoint 220px
    expect(yes).toHaveTextContent('Descartar');
    expect(yes).toHaveTextContent('Descartar e fechar');
    // aria-label + title carregam o texto completo para leitor de tela/tooltip
    expect(yes).toHaveAttribute('aria-label', 'Descartar e fechar');
    expect(yes).toHaveAttribute('title', 'Descartar e fechar');
    // whitespace-nowrap → impede quebra em duas linhas
    expect(yes.className).toContain('whitespace-nowrap');

    const no = screen.getByTestId('confirm-dialog-no');
    expect(no).toHaveAttribute('aria-label', 'Continuar editando');
    expect(no).toHaveAttribute('title', 'Continuar editando');
    expect(no.className).toContain('whitespace-nowrap');

    expect((dialog.getAttribute('class') ?? '')).toContain('!max-w-[358px]');
    expect(dialog.querySelector('[aria-hidden="true"].h-\\[3px\\]')).not.toBeNull();
  });

  it.each(WIDTHS)('em %ipx: variante warning com impactPreview mantém lista sem truncar itens', (width) => {
    setViewport(width);

    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Aplicar mudanças em lote?"
        description="Isso afetará múltiplos itens do orçamento."
        onConfirm={() => {}}
        variant="warning"
        impactPreview={{
          title: 'O que será alterado',
          items: [
            'Preço unitário de 3 itens',
            'Percentual de desconto do orçamento',
            'Recalcular total geral',
          ],
        }}
      />,
    );

    const impact = screen.getByTestId('confirm-dialog-impact');
    expect(impact).toBeInTheDocument();
    // Todos os 3 itens presentes (nenhum clipping via overflow)
    expect(impact.querySelectorAll('li')).toHaveLength(3);
    expect(impact).toHaveTextContent('Preço unitário de 3 itens');
    expect(impact).toHaveTextContent('Percentual de desconto do orçamento');
    expect(impact).toHaveTextContent('Recalcular total geral');
  });
});
