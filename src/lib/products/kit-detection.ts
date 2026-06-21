import type { Product } from '@/types/product-catalog';

type KitDetectionProduct = Pick<
  Product,
  'isKit' | 'name' | 'category' | 'category_name' | 'groups'
>;

interface KitDetectionContext {
  categoryName?: string | null;
  categoryPath?: readonly string[] | null;
}

const KIT_TOKEN_RE = /(^|\s|[-_/|])kits?(\s|$|[-_/|])/i;

function hasKitToken(value: string | null | undefined): boolean {
  if (!value) return false;
  return KIT_TOKEN_RE.test(
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim(),
  );
}

function hasKitNamePrefix(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^kits?(\s|$|[-_/|])/i.test(
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim(),
  );
}

export function isProductKit(
  product: KitDetectionProduct,
  context: KitDetectionContext = {},
): boolean {
  if (product.isKit) return true;

  const taxonomyCandidates = [
    product.category?.name,
    product.category_name,
    context.categoryName,
    ...(product.groups?.map((group) => group.name) ?? []),
    ...(context.categoryPath ?? []),
  ];

  return taxonomyCandidates.some(hasKitToken) || hasKitNamePrefix(product.name);
}
