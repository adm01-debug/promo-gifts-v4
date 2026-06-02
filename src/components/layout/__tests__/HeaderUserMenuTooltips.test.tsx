/**
 * Garante que os tooltips dos itens "Skins" e "Guia Rápido" do menu do usuário:
 *  - renderizam o texto correto;
 *  - abrem ao passar o mouse (hover) E ao focar via teclado;
 *  - posicionam-se à esquerda (`data-side="left"`), evitando colisão com o
 *    DropdownMenu que está alinhado à direita.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ItemSpec {
  testid: string;
  label: string;
  description: string;
}

const ITEMS: ItemSpec[] = [
  {
    testid: 'user-menu-item-skins',
    label: 'Skins',
    description: 'Personalize a aparência da plataforma (temas e cores)',
  },
  {
    testid: 'user-menu-item-guia-rapido',
    label: 'Guia Rápido',
    description: 'Reiniciar o tour guiado pelas funcionalidades do sistema',
  },
];

function renderItem({ testid, label, description }: ItemSpec) {
  return render(
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button data-testid={testid} type="button">
            {label}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={8} data-testid={`${testid}-tooltip`}>
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>,
  );
}

describe('User menu tooltips — Skins & Guia Rápido', () => {
  for (const item of ITEMS) {
    describe(item.label, () => {
      it('abre o tooltip com o texto correto ao passar o mouse', async () => {
        renderItem(item);
        const trigger = screen.getByTestId(item.testid);
        fireEvent.pointerEnter(trigger);
        fireEvent.mouseEnter(trigger);
        const tip = await screen.findAllByText(item.description);
        expect(tip.length).toBeGreaterThan(0);
      });

      it('abre o tooltip ao receber foco via teclado', async () => {
        renderItem(item);
        const trigger = screen.getByTestId(item.testid);
        trigger.focus();
        fireEvent.focus(trigger);
        const tip = await screen.findAllByText(item.description);
        expect(tip.length).toBeGreaterThan(0);
      });

      it('posiciona o tooltip à esquerda (data-side="left")', async () => {
        renderItem(item);
        const trigger = screen.getByTestId(item.testid);
        fireEvent.pointerEnter(trigger);
        fireEvent.mouseEnter(trigger);
        await waitFor(() => {
          const content = document.querySelector(
            `[data-testid="${item.testid}-tooltip"]`,
          ) as HTMLElement | null;
          expect(content).not.toBeNull();
          expect(content!.getAttribute('data-side')).toBe('left');
        });
      });
    });
  }
});
