/**
 * Paginação da revista — dado um Magazine, retorna as páginas na ordem
 * correta (capa, seções por categoria opcionais, páginas de produtos,
 * contracapa). O template define quantos itens por página.
 */

import type { Magazine, MagazineItem, MagazinePage } from '@/types/magazine';
import { getTemplate } from './components/templates/TemplateRegistry';

export function paginateMagazine(magazine: Magazine): MagazinePage[] {
  const template = getTemplate(magazine.templateId);
  const perPage = Math.max(1, template.productsPerPage);
  const items = [...magazine.items].sort((a, b) => a.position - b.position);

  const pages: MagazinePage[] = [
    { index: 0, kind: 'cover', items: [] },
  ];

  if (magazine.content.groupByCategory) {
    const grouped = new Map<string, MagazineItem[]>();
    for (const it of items) {
      const key = it.productSnapshot.category_name ?? 'Outros';
      const arr = grouped.get(key) ?? [];
      arr.push(it);
      grouped.set(key, arr);
    }
    for (const [category, list] of grouped) {
      pages.push({ index: pages.length, kind: 'section', sectionTitle: category, items: [] });
      for (let i = 0; i < list.length; i += perPage) {
        pages.push({
          index: pages.length,
          kind: 'products',
          items: list.slice(i, i + perPage),
        });
      }
    }
  } else {
    for (let i = 0; i < items.length; i += perPage) {
      pages.push({
        index: pages.length,
        kind: 'products',
        items: items.slice(i, i + perPage),
      });
    }
  }

  pages.push({ index: pages.length, kind: 'back-cover', items: [] });
  return pages;
}
