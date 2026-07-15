/**
 * EditorHero — testes de regressão.
 *
 * Garante que a mini-preview (`TemplateThumbnail`, agora deletado do repo)
 * não volta a ser importada/renderizada — nem no hero, nem no popover
 * "Trocar template". Qualquer reintrodução quebraria a compilação (arquivo
 * removido) e, na renderização, este teste verifica que nenhum elemento
 * `role="img"` da miniatura antiga aparece na tela.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { EditorHero } from '../EditorHero';
import type { Magazine } from '@/types/magazine';

const magazine: Magazine = {
  id: 'mag-1',
  ownerId: 'owner-1',
  organizationId: null,
  title: 'Nova Revista',
  subtitle: 'Subtítulo teste',
  templateId: 'editorial-vogue',
  branding: {
    clientName: null,
    clientLogoUrl: null,
    clientCrmId: null,
    colors: { primary: '#2e4a3a', accent: '#e86f2e', text: '#1a1a1a' },
  } as Magazine['branding'],
  content: {
    showPrice: true,
    showCode: true,
    showPersonalization: true,
    showDescription: true,
    showDimensions: false,
    showMaterials: false,
    showColors: true,
    groupByCategory: false,
  },
  items: [],
  pageOrder: null,
  status: 'draft',
  publicToken: null,
  pdfUrl: null,
  publishedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function renderHero() {
  return render(
    <MemoryRouter>
      <EditorHero magazine={magazine} onChangeTemplate={() => {}} />
    </MemoryRouter>,
  );
}

describe('EditorHero — sem mini preview', () => {
  it('renderiza título e breadcrumb sem TemplateThumbnail no hero', () => {
    renderHero();

    expect(screen.getByTestId('editor-hero')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: /Nova Revista/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Magazines')).toBeInTheDocument();
    // A miniatura antiga usava um SVG `role="img"` fiel. Sem ela, nada de img.
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('popover "Trocar template" abre sem miniaturas — apenas labels', async () => {
    const user = userEvent.setup();
    renderHero();

    await user.click(
      screen.getByRole('button', { name: /Trocar template da revista/i }),
    );

    // Grid de radios renderizado
    expect(
      await screen.findByRole('radiogroup', { name: /Escolher template/i }),
    ).toBeInTheDocument();

    // Nenhuma miniatura renderizada dentro do popover
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('clicar em um card do popover dispara onChangeTemplate e não renderiza miniaturas', async () => {
    const user = userEvent.setup();
    const onChangeTemplate = vi.fn();

    render(
      <MemoryRouter>
        <EditorHero magazine={magazine} onChangeTemplate={onChangeTemplate} />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole('button', { name: /Trocar template da revista/i }),
    );

    const group = await screen.findByRole('radiogroup', {
      name: /Escolher template/i,
    });

    // Sanity: nenhuma miniatura antes do clique
    expect(screen.queryAllByRole('img')).toHaveLength(0);

    // Escolhe um radio diferente do template ativo (editorial-vogue)
    const radios = screen.getAllByRole('radio');
    const target = radios.find(
      (r) => r.getAttribute('aria-checked') === 'false',
    );
    expect(target).toBeDefined();
    expect(group).toContainElement(target!);

    await user.click(target!);

    // Callback disparado exatamente 1 vez com um id de template válido (string não vazia)
    expect(onChangeTemplate).toHaveBeenCalledTimes(1);
    const [calledId] = onChangeTemplate.mock.calls[0];
    expect(typeof calledId).toBe('string');
    expect(calledId).not.toBe('editorial-vogue');
    expect((calledId as string).length).toBeGreaterThan(0);

    // Pós-clique: sem miniaturas em lugar algum da árvore
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('breadcrumb tem aria-current="page" no item Editor', () => {
    renderHero();
    const editorCrumb = screen.getByText('Editor');
    expect(editorCrumb).toHaveAttribute('aria-current', 'page');
  });

  it('popover "Trocar template" é navegável por teclado (Enter aciona onChangeTemplate)', async () => {
    const user = userEvent.setup();
    const onChangeTemplate = vi.fn();

    render(
      <MemoryRouter>
        <EditorHero magazine={magazine} onChangeTemplate={onChangeTemplate} />
      </MemoryRouter>,
    );

    // Abre popover via teclado (foca botão + Enter)
    const trigger = screen.getByRole('button', {
      name: /Trocar template da revista/i,
    });
    trigger.focus();
    await user.keyboard('{Enter}');

    const group = await screen.findByRole('radiogroup', {
      name: /Escolher template/i,
    });

    // Heading acessível visível dentro do popover
    expect(
      document.getElementById('magazine-template-swap-heading'),
    ).toHaveTextContent(/Trocar template/i);

    // Escolhe primeiro radio não-selecionado via foco + Enter
    const radios = screen.getAllByRole('radio');
    const target = radios.find(
      (r) => r.getAttribute('aria-checked') === 'false',
    );
    expect(target).toBeDefined();
    target!.focus();
    expect(target).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onChangeTemplate).toHaveBeenCalledTimes(1);
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('chip e botão "Trocar template" ficam na mesma linha flex do título', () => {
    renderHero();

    const row = screen.getByTestId('magazine-hero-title-row');
    const title = screen.getByTestId('page-title-magazine-editor');
    const chip = screen.getByTestId('magazine-template-chip');
    const trigger = screen.getByTestId('magazine-template-swap-trigger');

    // Todos são filhos diretos do mesmo container flex
    expect(row).toContainElement(title);
    expect(row).toContainElement(chip);
    expect(row).toContainElement(trigger);
    expect(title.parentElement).toBe(row);
    expect(chip.parentElement).toBe(row);
    // Radix asChild pode envolver o Button; garantimos que o trigger está dentro da mesma row
    expect(row.contains(trigger)).toBe(true);

    // Container é flex-wrap com items-center (alinhamento vertical consistente)
    expect(row.className).toMatch(/\bflex\b/);
    expect(row.className).toMatch(/flex-wrap/);
    expect(row.className).toMatch(/items-center/);
  });

  it('aria-expanded do botão "Trocar template" reflete o estado do popover', async () => {
    const user = userEvent.setup();
    renderHero();

    const trigger = screen.getByTestId('magazine-template-swap-trigger');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-controls', 'magazine-template-swap-popover');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('chip do template expõe aria-label descritivo (nome, família, produtos/página)', () => {
    renderHero();
    const chip = screen.getByTestId('magazine-template-chip');
    expect(chip).toHaveAttribute('role', 'group');
    expect(chip.getAttribute('aria-label')).toMatch(/Template ativo/i);
    expect(chip.getAttribute('aria-label')).toMatch(/por página/i);
  });
});
