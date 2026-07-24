/**
 * Paginação da revista — dado um Magazine, retorna as páginas na ordem
 * correta (capa, seções por categoria opcionais, páginas de produtos,
 * contracapa). O template define quantos itens por página.
 *
 * PhD-level null safety:
 * - Accepts null/undefined magazine → returns empty pages
 * - Optional chaining on all nested fields
 * - Position sort handles null/undefined positions
 * - Template fallback when templateId not found
 */

import type { Magazine, MagazineItem, MagazinePage } from '@/types/magazine';
import { getTemplate } from './components/templates/TemplateRegistry';

/**
 * paginateMagazine — deterministic, pure function.
 * No side effects. Safe to call in useMemo.
 *
 * @param magazine - The magazine to paginate. Accepts null/undefined defensively.
 * @returns Array of pages in display order: [cover, ...sections/products, back-cover]
 */
export function paginateMagazine(magazine: Magazine | null | undefined): MagazinePage[] {
  // GAP #3 FIX: null guard — return minimum valid pages on missing data
  if (!magazine) {
    return [
      { index: 0, kind: 'cover', items: [] },
      { index: 1, kind: 'back-cover', items: [] },
    ];
  }

  // GAP #3 FIX: template null guard — use fallback productsPerPage if template not found
  const template = getTemplate(magazine.templateId);
  const perPage = Math.max(1, template?.productsPerPage ?? 2);

  // GAP #6 FIX: defensive array check + immutable sort (spread first)
  const rawItems = Array.isArray(magazine.items) ? magazine.items : [];
  const items = [...rawItems].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0) // FIX: null position → 0
  );

  const pages: MagazinePage[] = [
    { index: 0, kind: 'cover', items: [] },
  ];

  // GAP #3 FIX: optional chaining on content — magazine.content may be undefined
  // during hydration or if created with a legacy schema.
  if (magazine.content?.groupByCategory) {
    const grouped = new Map<string, MagazineItem[]>();
    for (const it of items) {
      // FIX: optional chaining on productSnapshot — defensive for partial saves
      const key = it.productSnapshot?.category_name ?? 'Outros';
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

/**
 * getTotalProductCount — counts all products across all pages.
 * Useful for badge displays and validation.
 */
export function getTotalProductCount(magazine: Magazine | null | undefined): number {
  if (!magazine) return 0;
  return Array.isArray(magazine.items) ? magazine.items.length : 0;
}

/**
 * getPageCount — returns total rendered page count.
 * Includes cover + back-cover. Minimum: 2.
 */
export function getPageCount(magazine: Magazine | null | undefined): number {
  return paginateMagazine(magazine).length;
}
