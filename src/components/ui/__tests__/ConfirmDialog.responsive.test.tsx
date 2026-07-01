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
        cancelLabel="Continuar editando"
        onConfirm={() => {}}
        variant="destructive"
      />,
    );

    const dialog = screen.getByRole('alertdialog');

    // 1) título/descrição no DOM sem clipping
    expect(screen.getByText('Descartar alterações?')).toBeInTheDocument();
    expect(
      screen.getByText(/Você tem alterações não salvas neste item/i),
    ).toBeInTheDocument();

    // 2) ambos botões renderizados e acessíveis
    expect(screen.getByTestId('confirm-dialog-yes')).toHaveTextContent('Descartar e fechar');
    expect(screen.getByTestId('confirm-dialog-no')).toHaveTextContent('Continuar editando');

    // 3) classe max-w-[15rem] (240px) preserva contenção horizontal — nunca excede viewport
    const contentClass = dialog.getAttribute('class') ?? '';
    expect(contentClass).toContain('max-w-[15rem]');

    // 4) accent bar presente
    const accent = dialog.querySelector('[aria-hidden="true"].h-\\[3px\\]');
    expect(accent).not.toBeNull();

    // 5) footer com os dois botões dentro do dialog
    expect(dialog.contains(screen.getByTestId('confirm-dialog-yes'))).toBe(true);
    expect(dialog.contains(screen.getByTestId('confirm-dialog-no'))).toBe(true);
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
