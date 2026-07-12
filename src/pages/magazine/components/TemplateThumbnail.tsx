/**
 * TemplateThumbnail — miniatura FIEL de um template.
 * Renderiza a página real do template em 1920×2716 escalada ao contêiner,
 * usando os produtos da revista atual OU placeholders quando vazio.
 */

import { useEffect, useRef, useState } from 'react';
import type { Magazine, MagazineItem, MagazineTemplateId } from '@/types/magazine';
import { DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';
import { getTemplate } from './templates/TemplateRegistry';

interface Props {
  templateId: MagazineTemplateId;
  /** Se fornecido, usa produtos reais da revista atual para prévia. */
  sourceMagazine?: Magazine;
}

const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="%23e5e7eb"/><path d="M100 260 L170 200 L220 240 L280 170 L340 260 Z" fill="%23cbd5e1"/><circle cx="130" cy="150" r="24" fill="%23cbd5e1"/></svg>`,
  );

function makePlaceholderItem(idx: number): MagazineItem {
  return {
    id: `ph-${idx}`,
    productId: `ph-${idx}`,
    variantColorName: null,
    position: idx,
    pageNumber: null,
    overrides: {},
    productSnapshot: {
      id: `ph-${idx}`,
      name: ['Aurora Notebook', 'Copo Térmico', 'Mochila Executiva', 'Ecobag Signature', 'Squeeze Premium', 'Caneta Delta'][idx % 6],
      sku: `SKU-${100 + idx}`,
      shortDescription: 'Produto de alto padrão com acabamento premium e opções de personalização.',
      description: null,
      price: 49.9 + idx * 10,
      image_url: PLACEHOLDER_IMG,
      images: [],
      colors: [],
      materials: ['Alumínio', 'Silicone'],
      hasPersonalization: true,
      category_id: null,
      category_name: 'Categoria',
    },
  };
}


export function TemplateThumbnail({ templateId, sourceMagazine }: Props) {
  const template = getTemplate(templateId);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / 1920);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const perPage = template.productsPerPage;
  const items =
    sourceMagazine && sourceMagazine.items.length > 0
      ? sourceMagazine.items.slice(0, perPage)
      : Array.from({ length: perPage }, (_, i) => makePlaceholderItem(i));

  const magazine: Magazine = sourceMagazine ?? {
    id: 'preview',
    ownerId: 'preview',
    organizationId: null,
    title: 'Coleção 2026',
    subtitle: 'Uma seleção especial',
    templateId,
    branding: { ...DEFAULT_BRANDING },
    content: { ...DEFAULT_MAGAZINE_CONTENT },
    items,
    pageOrder: null,
    status: 'draft',
    publicToken: null,
    pdfUrl: null,
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const page = {
    index: 1,
    kind: 'products' as const,
    items,
  };

  const style: React.CSSProperties = {
    '--mag-primary': magazine.branding.colors.primary || template.defaultColors.primary,
    '--mag-secondary': magazine.branding.colors.secondary || template.defaultColors.secondary,
    '--mag-text': magazine.branding.colors.text || template.defaultColors.text,
    '--mag-heading': `'${template.fonts.heading}', serif`,
    '--mag-body': `'${template.fonts.body}', 'Outfit', system-ui, sans-serif`,
  } as React.CSSProperties;

  const Component = template.Component;

  return (
    <div
      ref={wrapperRef}
      className="mag-preview-wrapper mag-scope aspect-[3/4] w-full overflow-hidden rounded-t-lg bg-neutral-100"
      style={style}
      aria-hidden
    >
      <div style={{ transform: `scale(${scale})`, width: 1920, height: 2716 }}>
        <Component magazine={magazine} page={page} totalPages={4} />
      </div>
    </div>
  );
}
