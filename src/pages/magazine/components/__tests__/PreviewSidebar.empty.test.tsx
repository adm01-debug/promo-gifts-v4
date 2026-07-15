/**
 * PreviewSidebar — testes de acessibilidade do estado vazio.
 *
 * Garante que quando não há capa/páginas para exibir, o fallback exibido
 * é anunciado por leitores de tela (role="status" + aria-live="polite")
 * e traz título/instrução textuais claras.
 */

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { PreviewSidebar } from '../PreviewSidebar';
import type { Magazine } from '@/types/magazine';

const emptyMagazine: Magazine = {
  id: 'mag-1',
  ownerId: 'owner-1',
  organizationId: null,
  title: 'Nova Revista',
  subtitle: '',
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

describe('PreviewSidebar — estado vazio acessível', () => {
  it('renderiza fallback com role="status" e aria-live quando não há páginas', () => {
    render(
      <PreviewSidebar
        magazine={emptyMagazine}
        pages={[]}
        activeIdx={0}
        onSelect={() => {}}
        onOpenAll={() => {}}
      />,
    );

    const empty = screen.getByTestId('preview-empty-state');
    expect(empty).toBeInTheDocument();
    expect(empty).toHaveAttribute('role', 'status');
    expect(empty).toHaveAttribute('aria-live', 'polite');

    // Título e instrução legíveis (não são apenas ícones aria-hidden)
    expect(within(empty).getByText(/Sem capa para exibir/i)).toBeInTheDocument();
    expect(
      within(empty).getByText(/Adicione produtos ou escolha um template/i),
    ).toBeInTheDocument();
  });

  it('não renderiza o fallback quando existem páginas', () => {
    render(
      <PreviewSidebar
        magazine={emptyMagazine}
        pages={[
          {
            index: 0,
            kind: 'cover',
            items: [],
          },
        ]}
        activeIdx={0}
        onSelect={() => {}}
        onOpenAll={() => {}}
      />,
    );

    expect(screen.queryByTestId('preview-empty-state')).toBeNull();
  });
});
