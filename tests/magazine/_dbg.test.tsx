import { render } from '@testing-library/react';
import { useState } from 'react';
import { PreviewSidebar } from '@/pages/magazine/components/PreviewSidebar';
import { paginateMagazine } from '@/pages/magazine/pagination';
import { DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';
import { describe, it, vi } from 'vitest';

vi.mock('@/pages/magazine/components/MagazinePageRenderer', () => ({
  MagazinePageRenderer: ({ page }: any) => <div>page-{page.index}</div>,
}));

describe('dbg', () => {
  it('shows html', () => {
    const items = Array.from({ length: 8 }, (_, i) => ({
      id: `item-${i}`, productId: `p-${i}`, variantColorName: null, position: i, pageNumber: null, overrides: {},
      productSnapshot: { id: `p-${i}`, name: `P${i}`, sku: `S${i}`, shortDescription: 'x', description: null, price: 1, image_url: '', images: [], colors: [], materials: [], hasPersonalization: false, category_id: null, category_name: null },
    }));
    const magazine: any = { id: 'm', ownerId: 'u', organizationId: null, title: 't', subtitle: '', templateId: 'catalog-grid', branding: {...DEFAULT_BRANDING}, content: {...DEFAULT_MAGAZINE_CONTENT}, items, pageOrder: null, status: 'draft', publicToken: null, pdfUrl: null, publishedAt: null, createdAt: '', updatedAt: '' };
    const pages = paginateMagazine(magazine);
    console.log('pages.length=', pages.length);
    const { container } = render(<PreviewSidebar magazine={magazine} pages={pages} activePageIdx={2} onSelectPage={() => {}} highlightedItemId={null} />);
    const btns = container.querySelectorAll('button[aria-label^="Ir para página"]');
    console.log('thumbs=', btns.length);
    btns.forEach((b, i) => console.log(i, b.getAttribute('aria-label'), 'aria-current=', b.getAttribute('aria-current'), 'className=', b.className));
  });
});
