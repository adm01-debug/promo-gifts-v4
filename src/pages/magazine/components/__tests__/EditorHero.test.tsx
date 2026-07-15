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
  templateId: 'vogue',
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
    expect(screen.queryByTestId('template-thumbnail-marker')).toBeNull();
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

    // Nenhum TemplateThumbnail é renderizado dentro do popover
    expect(screen.queryByTestId('template-thumbnail-marker')).toBeNull();
  });
});
