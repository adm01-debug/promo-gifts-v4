/**
 * DesignStep — regressão pós-remoção do TemplateThumbnail.
 *
 * Garante que a galeria de templates renderiza apenas metadados (nome,
 * descrição, badges) sem qualquer miniatura visual — nenhum `<img>` ou
 * `role="img"` deve aparecer nos cards.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { DesignStep } from '../DesignStep';
import type { Magazine } from '@/types/magazine';

const magazine: Magazine = {
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
    category: 'technology',
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
  viewCount: 0,
  publishedAt: null,
  archivedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('DesignStep — sem miniaturas', () => {
  it('renderiza cards de template sem <img> nem role="img"', () => {
    render(
      <MemoryRouter>
        <DesignStep
          magazine={magazine}
          onChange={() => {}}
          onCategoryChange={() => {}}
        />
      </MemoryRouter>,
    );

    // Sanity: cards de template presentes
    expect(screen.getByTestId('magazine-template-editorial-vogue')).toBeInTheDocument();

    // Nenhum <img> renderizado (o TemplateThumbnail antigo usava SVG role="img")
    expect(screen.queryAllByRole('img')).toHaveLength(0);
    expect(document.querySelectorAll('img')).toHaveLength(0);
  });

  it('não renderiza o rodapé antigo "as miniaturas usam produtos de amostra"', () => {
    render(
      <MemoryRouter>
        <DesignStep
          magazine={magazine}
          onChange={() => {}}
          onCategoryChange={() => {}}
        />
      </MemoryRouter>,
    );

    expect(
      screen.queryByText(/miniaturas usam produtos de amostra/i),
    ).toBeNull();
  });
});
