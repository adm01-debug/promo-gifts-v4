/**
 * Testes de comportamento e acessibilidade do fluxo "Salvar Rascunho" no
 * QuoteBuilderSummaryColumn: modal só abre em isEditMode, cancelar bloqueia
 * onSave, confirmar dispara onSave('draft') uma única vez, e navegação por
 * teclado no Dialog está OK (Radix + shadcn).
 *
 * Harness minimal — espelha o par botão + Dialog do source (linhas 1414-1500
 * do QuoteBuilderSummaryColumn.tsx), sem precisar montar toda a árvore do
 * builder (Supabase / dnd-kit / providers).
 */
import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Save } from 'lucide-react';

function SaveDraftHarness({
  isEditMode,
  onSave,
}: {
  isEditMode: boolean;
  onSave: (mode: 'draft') => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="lg"
              data-testid="quote-save-draft"
              aria-label="Salvar Rascunho"
              onClick={() => (isEditMode ? setOpen(true) : onSave('draft'))}
            >
              <Save className="mr-2 h-4 w-4" />
              Salvar Rascunho
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isEditMode
              ? 'Grava o orçamento inteiro no banco (itens, descontos e notas). Não envia para aprovação.'
              : 'Cria um rascunho do orçamento no banco para você continuar depois.'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="quote-save-draft-confirm-dialog">
          <DialogHeader>
            <DialogTitle>Salvar rascunho do orçamento?</DialogTitle>
            <DialogDescription>
              Todas as alterações feitas neste orçamento (itens, quantidades, descontos, markup e
              notas) serão gravadas no banco. O orçamento não será enviado para aprovação nem para o
              cliente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              data-testid="quote-save-draft-confirm"
              aria-label="Salvar Rascunho"
              onClick={() => {
                setOpen(false);
                onSave('draft');
              }}
            >
              Salvar Rascunho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

describe('QuoteBuilderSummaryColumn — fluxo Salvar Rascunho', () => {
  it('modo edição: clique abre o Dialog e NÃO chama onSave direto', async () => {
    const onSave = vi.fn();
    render(<SaveDraftHarness isEditMode onSave={onSave} />);
    await userEvent.click(screen.getByTestId('quote-save-draft'));
    expect(screen.getByTestId('quote-save-draft-confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Salvar rascunho do orçamento\?/)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('modo edição: Cancelar fecha o modal e bloqueia onSave', async () => {
    const onSave = vi.fn();
    render(<SaveDraftHarness isEditMode onSave={onSave} />);
    await userEvent.click(screen.getByTestId('quote-save-draft'));
    const dialog = screen.getByTestId('quote-save-draft-confirm-dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /cancelar/i }));
    expect(screen.queryByTestId('quote-save-draft-confirm-dialog')).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("modo edição: Confirmar chama onSave('draft') exatamente uma vez e fecha o modal", async () => {
    const onSave = vi.fn();
    render(<SaveDraftHarness isEditMode onSave={onSave} />);
    await userEvent.click(screen.getByTestId('quote-save-draft'));
    await userEvent.click(screen.getByTestId('quote-save-draft-confirm'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('draft');
    expect(screen.queryByTestId('quote-save-draft-confirm-dialog')).not.toBeInTheDocument();
  });

  it('modo criação (rascunho): clique dispara onSave direto, sem abrir modal', async () => {
    const onSave = vi.fn();
    render(<SaveDraftHarness isEditMode={false} onSave={onSave} />);
    await userEvent.click(screen.getByTestId('quote-save-draft'));
    expect(screen.queryByTestId('quote-save-draft-confirm-dialog')).not.toBeInTheDocument();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('draft');
  });

  it('label + aria-label do botão são sempre "Salvar Rascunho" independente de isEditMode', () => {
    const { rerender } = render(<SaveDraftHarness isEditMode onSave={vi.fn()} />);
    const btnEdit = screen.getByTestId('quote-save-draft');
    expect(btnEdit).toHaveTextContent(/^Salvar Rascunho$/);
    expect(btnEdit).toHaveAttribute('aria-label', 'Salvar Rascunho');
    rerender(<SaveDraftHarness isEditMode={false} onSave={vi.fn()} />);
    const btnNew = screen.getByTestId('quote-save-draft');
    expect(btnNew).toHaveTextContent(/^Salvar Rascunho$/);
    expect(btnNew).toHaveAttribute('aria-label', 'Salvar Rascunho');
  });

  it('modo edição: botão de confirmação do Dialog usa "Salvar Rascunho" (texto + aria-label)', async () => {
    render(<SaveDraftHarness isEditMode onSave={vi.fn()} />);
    await userEvent.click(screen.getByTestId('quote-save-draft'));
    const confirm = screen.getByTestId('quote-save-draft-confirm');
    expect(confirm).toHaveTextContent(/^Salvar Rascunho$/);
    expect(confirm).toHaveAttribute('aria-label', 'Salvar Rascunho');
    // Título do Dialog explicita "rascunho do orçamento" (mensagem consistente).
    expect(screen.getByText(/Salvar rascunho do orçamento\?/i)).toBeInTheDocument();
  });

  it('Escape fecha o Dialog sem disparar onSave (acessibilidade teclado)', async () => {
    const onSave = vi.fn();
    render(<SaveDraftHarness isEditMode onSave={onSave} />);
    await userEvent.click(screen.getByTestId('quote-save-draft'));
    fireEvent.keyDown(screen.getByTestId('quote-save-draft-confirm-dialog'), {
      key: 'Escape',
      code: 'Escape',
    });
    // Radix pode desmontar assíncrono; consultamos com queryBy
    await new Promise<void>((r) => {
      setTimeout(r, 50);
    });
    expect(screen.queryByTestId('quote-save-draft-confirm-dialog')).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Dialog tem título + descrição acessíveis (Radix aria-labelledby/describedby)', async () => {
    render(<SaveDraftHarness isEditMode onSave={vi.fn()} />);
    await userEvent.click(screen.getByTestId('quote-save-draft'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');
  });
});
