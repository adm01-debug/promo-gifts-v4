/**
 * MagazineService — persistência v1 local (localStorage) + hooks para
 * migração ao BD Gold quando disponível. Preserva o SSOT em src/types/magazine.
 */

import type {
  Magazine,
  MagazineClientBranding,
  MagazineContentSettings,
  MagazineItem,
  MagazineProductSnapshot,
  MagazineTemplateId,
} from '@/types/magazine';
import {
  DEFAULT_BRANDING,
  DEFAULT_MAGAZINE_CONTENT,
} from '@/types/magazine';
import type { Product } from '@/types/product-catalog';
import { logger } from '@/lib/logger';

const STORAGE_KEY = 'promobrind.magazines.v1';
const TOKEN_INDEX_KEY = 'promobrind.magazines.tokenIndex.v1';

function readAll(): Magazine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Magazine[]) : [];
  } catch (err) {
    logger.warn('[magazineService] Falha ao ler localStorage:', err);
    return [];
  }
}

function writeAll(list: Magazine[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    logger.error('[magazineService] Falha ao gravar localStorage:', err);
  }
}

function writeTokenIndex(token: string, id: string): void {
  try {
    const raw = localStorage.getItem(TOKEN_INDEX_KEY);
    const idx = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    idx[token] = id;
    localStorage.setItem(TOKEN_INDEX_KEY, JSON.stringify(idx));
  } catch (err) {
    logger.warn('[magazineService] Falha ao gravar índice de token:', err);
  }
}

function readTokenIndex(): Record<string, string> {
  try {
    const raw = localStorage.getItem(TOKEN_INDEX_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function productToSnapshot(product: Product): MagazineProductSnapshot {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    shortDescription: product.shortDescription ?? '',
    description: product.description ?? null,
    price: product.price,
    sale_price: product.sale_price,
    image_url:
      product.primary_image_url || product.image_url || product.images?.[0] || '',
    images: product.images ?? [],
    colors: product.colors ?? [],
    category_name: product.category_name ?? null,
    category_id: product.category_id ?? null,
    materials: product.materials ?? [],
    hasPersonalization: product.hasPersonalization ?? null,
    dimensions: product.dimensions,
  };
}

function newId(prefix: string): string {
  // eslint-disable-next-line no-restricted-globals
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${rnd}`;
}

export const magazineService = {
  list(ownerId: string): Magazine[] {
    return readAll()
      .filter((m) => m.ownerId === ownerId)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  },

  get(id: string): Magazine | null {
    return readAll().find((m) => m.id === id) ?? null;
  },

  getByToken(token: string): Magazine | null {
    const idx = readTokenIndex();
    const id = idx[token];
    if (!id) return null;
    return this.get(id);
  },

  create(input: {
    ownerId: string;
    organizationId?: string | null;
    title?: string;
    templateId?: MagazineTemplateId;
  }): Magazine {
    const now = new Date().toISOString();
    const magazine: Magazine = {
      id: newId('mag'),
      ownerId: input.ownerId,
      organizationId: input.organizationId ?? null,
      title: input.title ?? 'Nova Revista',
      subtitle: '',
      templateId: input.templateId ?? 'editorial-vogue',
      branding: { ...DEFAULT_BRANDING },
      content: { ...DEFAULT_MAGAZINE_CONTENT },
      items: [],
      pageOrder: null,
      status: 'draft',
      publicToken: null,
      pdfUrl: null,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const all = readAll();
    all.push(magazine);
    writeAll(all);
    return magazine;
  },

  update(id: string, patch: Partial<Magazine>): Magazine | null {
    const all = readAll();
    const idx = all.findIndex((m) => m.id === id);
    if (idx < 0) return null;
    const updated: Magazine = {
      ...all[idx],
      ...patch,
      id: all[idx].id,
      ownerId: all[idx].ownerId,
      createdAt: all[idx].createdAt,
      updatedAt: new Date().toISOString(),
    };
    all[idx] = updated;
    writeAll(all);
    return updated;
  },

  updateContent(id: string, patch: Partial<MagazineContentSettings>): Magazine | null {
    const current = this.get(id);
    if (!current) return null;
    return this.update(id, { content: { ...current.content, ...patch } });
  },

  updateBranding(id: string, patch: Partial<MagazineClientBranding>): Magazine | null {
    const current = this.get(id);
    if (!current) return null;
    return this.update(id, { branding: { ...current.branding, ...patch } });
  },

  addProducts(id: string, products: Product[]): Magazine | null {
    const current = this.get(id);
    if (!current) return null;
    const existingIds = new Set(current.items.map((i) => i.productId));
    const additions: MagazineItem[] = products
      .filter((p) => !existingIds.has(p.id))
      .map((p, offset) => ({
        id: newId('item'),
        productId: p.id,
        productSnapshot: productToSnapshot(p),
        variantColorName: p.colors?.[0]?.name ?? null,
        position: current.items.length + offset,
        pageNumber: null,
        overrides: {},
      }));
    if (additions.length === 0) return current;
    return this.update(id, { items: [...current.items, ...additions] });
  },

  removeItem(id: string, itemId: string): Magazine | null {
    const current = this.get(id);
    if (!current) return null;
    const items = current.items
      .filter((i) => i.id !== itemId)
      .map((i, idx) => ({ ...i, position: idx }));
    return this.update(id, { items });
  },

  reorderItems(id: string, orderedIds: string[]): Magazine | null {
    const current = this.get(id);
    if (!current) return null;
    const byId = new Map(current.items.map((i) => [i.id, i]));
    const items: MagazineItem[] = orderedIds
      .map((iid, idx) => {
        const it = byId.get(iid);
        return it ? { ...it, position: idx } : null;
      })
      .filter((x): x is MagazineItem => x !== null);
    return this.update(id, { items });
  },

  updateItem(id: string, itemId: string, patch: Partial<MagazineItem>): Magazine | null {
    const current = this.get(id);
    if (!current) return null;
    const items = current.items.map((i) => (i.id === itemId ? { ...i, ...patch, id: i.id } : i));
    return this.update(id, { items });
  },

  duplicate(id: string): Magazine | null {
    const current = this.get(id);
    if (!current) return null;
    const clone = this.create({
      ownerId: current.ownerId,
      organizationId: current.organizationId,
      title: `${current.title} (cópia)`,
      templateId: current.templateId,
    });
    return this.update(clone.id, {
      branding: current.branding,
      content: current.content,
      items: current.items.map((i) => ({ ...i, id: newId('item') })),
    });
  },

  delete(id: string): void {
    const all = readAll().filter((m) => m.id !== id);
    writeAll(all);
  },

  publish(id: string): Magazine | null {
    const current = this.get(id);
    if (!current) return null;
    const token = current.publicToken ?? newId('tok').replace('tok_', '');
    writeTokenIndex(token, id);
    return this.update(id, {
      status: 'published',
      publicToken: token,
      publishedAt: new Date().toISOString(),
    });
  },

  unpublish(id: string): Magazine | null {
    return this.update(id, { status: 'draft' });
  },
};
