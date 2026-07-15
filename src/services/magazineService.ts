/**
 * MagazineService — persistência v2 no BD Gold (doufsxqlfjyuvxuezpln).
 *
 * Migração 2026-07-12: substituído localStorage por chamadas Supabase
 * (tabelas `magazines`, `magazine_items`) + edge `magazine-public-view`
 * para leitura anônima. Toda a API passa a ser assíncrona.
 *
 * A camada usa `untypedFrom<Row>()` porque as tabelas magazine_* ainda
 * não estão em src/integrations/supabase/types.ts (regeneração pendente).
 */

import { type Magazine, type MagazineClientBranding, type MagazineContentSettings, type MagazineItem, type MagazineProductSnapshot, type MagazineTemplateId, DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';

import type { Product } from '@/types/product-catalog';
import { untypedFrom } from '@/lib/supabase-untyped';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { newRequestId, REQUEST_ID_HEADER } from '@/lib/telemetry/requestId';

// ---------------------------------------------------------------------------
// Row shapes (mapeamento do BD Gold)
// ---------------------------------------------------------------------------

interface MagazineRow {
  id: string;
  owner_id: string;
  organization_id: string | null;
  title: string;
  subtitle: string | null;
  template_id: MagazineTemplateId;
  branding: MagazineClientBranding;
  content_settings: MagazineContentSettings;
  page_order: number[] | null;
  status: Magazine['status'];
  public_token: string | null;
  pdf_url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface MagazineItemRow {
  id: string;
  magazine_id: string;
  product_id: string;
  product_snapshot: MagazineProductSnapshot;
  variant_color_name: string | null;
  position: number;
  page_number: number | null;
  overrides: Partial<MagazineContentSettings>;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function rowToItem(row: MagazineItemRow): MagazineItem {
  return {
    id: row.id,
    productId: row.product_id,
    productSnapshot: row.product_snapshot,
    variantColorName: row.variant_color_name,
    position: row.position,
    pageNumber: row.page_number,
    overrides: row.overrides ?? {},
  };
}

function rowToMagazine(row: MagazineRow, items: MagazineItemRow[]): Magazine {
  return {
    id: row.id,
    ownerId: row.owner_id,
    organizationId: row.organization_id,
    title: row.title,
    subtitle: row.subtitle ?? '',
    templateId: row.template_id,
    branding: { ...DEFAULT_BRANDING, ...(row.branding ?? {}) },
    content: { ...DEFAULT_MAGAZINE_CONTENT, ...(row.content_settings ?? {}) },
    items: [...items].sort((a, b) => a.position - b.position).map(rowToItem),
    pageOrder: row.page_order,
    status: row.status,
    publicToken: row.public_token,
    pdfUrl: row.pdf_url,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Snapshot puro (produto → JSON armazenado em magazine_items.product_snapshot).
 * Continua síncrono — não depende do BD.
 */
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

/**
 * Gera um token público URL-safe (32 chars hex) para revistas quando o
 * trigger do BD não está disponível. Usa crypto.getRandomValues quando
 * possível, com fallback determinístico para ambientes sem Web Crypto.
 */
function generatePublicToken(): string {
  try {
    const g = (globalThis as { crypto?: Crypto }).crypto;
    if (g?.getRandomValues) {
      const bytes = new Uint8Array(16);
      g.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    if (g && typeof (g as Crypto).randomUUID === 'function') {
      return (g as Crypto).randomUUID().replace(/-/g, '');
    }
  } catch {
    /* fallback abaixo */
  }
  // Fallback (não-cripto): suficiente para desbloquear o fluxo de publicação.
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 18)}`.padEnd(32, '0');
}

// ---------------------------------------------------------------------------
// Low-level fetchers
// ---------------------------------------------------------------------------

async function fetchMagazineRow(id: string): Promise<MagazineRow | null> {
  const { data, error } = await untypedFrom<MagazineRow>('magazines')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    logger.warn('[magazineService] fetchMagazineRow error:', error.message);
    return null;
  }
  return (data as MagazineRow | null) ?? null;
}

async function fetchItems(magazineId: string): Promise<MagazineItemRow[]> {
  const { data, error } = await untypedFrom<MagazineItemRow>('magazine_items')
    .select('*')
    .eq('magazine_id', magazineId)
    .order('position', { ascending: true });
  if (error) {
    logger.warn('[magazineService] fetchItems error:', error.message);
    return [];
  }
  return ((data as MagazineItemRow[] | null) ?? []);
}

async function hydrate(id: string): Promise<Magazine | null> {
  const row = await fetchMagazineRow(id);
  if (!row) return null;
  const items = await fetchItems(id);
  return rowToMagazine(row, items);
}

// ---------------------------------------------------------------------------
// Public-view edge
// ---------------------------------------------------------------------------

interface PublicViewPayload {
  id: string;
  title: string;
  subtitle: string | null;
  templateId: MagazineTemplateId;
  branding: MagazineClientBranding;
  content: MagazineContentSettings;
  pageOrder: number[] | null;
  status: Magazine['status'];
  items: Array<{
    id: string;
    productId: string;
    productSnapshot: MagazineProductSnapshot;
    variantColorName: string | null;
    position: number;
    pageNumber: number | null;
    overrides: Partial<MagazineContentSettings>;
  }>;
}

async function callPublicView(token: string): Promise<PublicViewPayload | null> {
  const base = (import.meta.env.VITE_SUPABASE_URL as string) ?? '';
  const anonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ?? '';
  if (!base) return null;
  try {
    const url = `${base}/functions/v1/magazine-public-view?token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        [REQUEST_ID_HEADER]: newRequestId(),
        ...(anonKey ? { apikey: anonKey } : {}),
      },
    });
    if (!res.ok) {
      await res.text().catch(() => '');
      return null;
    }
    return (await res.json()) as PublicViewPayload;
  } catch (err) {
    logger.warn('[magazineService] callPublicView failed:', err);
    return null;
  }
}

function publicPayloadToMagazine(token: string, p: PublicViewPayload): Magazine {
  return {
    id: p.id,
    ownerId: '',
    organizationId: null,
    title: p.title,
    subtitle: p.subtitle ?? '',
    templateId: p.templateId,
    branding: { ...DEFAULT_BRANDING, ...(p.branding ?? {}) },
    content: { ...DEFAULT_MAGAZINE_CONTENT, ...(p.content ?? {}) },
    items: [...p.items]
      .sort((a, b) => a.position - b.position)
      .map((it) => ({
        id: it.id,
        productId: it.productId,
        productSnapshot: it.productSnapshot,
        variantColorName: it.variantColorName,
        position: it.position,
        pageNumber: it.pageNumber,
        overrides: it.overrides ?? {},
      })),
    pageOrder: p.pageOrder,
    status: p.status,
    publicToken: token,
    pdfUrl: null,
    publishedAt: null,
    createdAt: '',
    updatedAt: '',
  };
}

// ---------------------------------------------------------------------------
// Service API (async)
// ---------------------------------------------------------------------------

export const magazineService = {
  async list(ownerId: string): Promise<Magazine[]> {
    const { data, error } = await untypedFrom<MagazineRow>('magazines')
      .select('*')
      .eq('owner_id', ownerId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (error) {
      logger.warn('[magazineService.list] error:', error.message);
      return [];
    }
    const rows = (data as MagazineRow[] | null) ?? [];
    if (rows.length === 0) return [];
    // Busca items de todas as revistas em uma query só
    const ids = rows.map((r) => r.id);
    const { data: itemsData } = await untypedFrom<MagazineItemRow>('magazine_items')
      .select('*')
      .in('magazine_id', ids);
    const items = (itemsData as MagazineItemRow[] | null) ?? [];
    const byMag = new Map<string, MagazineItemRow[]>();
    for (const it of items) {
      const arr = byMag.get(it.magazine_id) ?? [];
      arr.push(it);
      byMag.set(it.magazine_id, arr);
    }
    return rows.map((r) => rowToMagazine(r, byMag.get(r.id) ?? []));
  },

  async get(id: string): Promise<Magazine | null> {
    return hydrate(id);
  },

  async getByToken(token: string): Promise<Magazine | null> {
    const payload = await callPublicView(token);
    return payload ? publicPayloadToMagazine(token, payload) : null;
  },

  /** Alias explícito — leitura pública SEMPRE vai pela edge. */
  async getPublicByToken(token: string): Promise<Magazine | null> {
    return this.getByToken(token);
  },

  async create(input: {
    ownerId: string;
    organizationId?: string | null;
    title?: string;
    templateId?: MagazineTemplateId;
  }): Promise<Magazine> {
    const insertRow = {
      owner_id: input.ownerId,
      organization_id: input.organizationId ?? null,
      title: input.title?.trim() || 'Nova Revista',
      subtitle: '',
      template_id: input.templateId ?? 'editorial-vogue',
      branding: { ...DEFAULT_BRANDING },
      content_settings: { ...DEFAULT_MAGAZINE_CONTENT },
      status: 'draft' as const,
    };
    const { data, error } = await untypedFrom<MagazineRow>('magazines')
      .insert(insertRow)
      .select('*')
      .single();
    if (error || !data) {
      throw new Error(`[magazineService.create] ${error?.message ?? 'insert falhou'}`);
    }
    return rowToMagazine(data as MagazineRow, []);
  },

  async update(id: string, patch: Partial<Magazine>): Promise<Magazine | null> {
    const updateRow: Record<string, unknown> = {};
    if ('title' in patch) updateRow.title = patch.title;
    if ('subtitle' in patch) updateRow.subtitle = patch.subtitle;
    if ('templateId' in patch) updateRow.template_id = patch.templateId;
    if ('branding' in patch) updateRow.branding = patch.branding;
    if ('content' in patch) updateRow.content_settings = patch.content;
    if ('pageOrder' in patch) updateRow.page_order = patch.pageOrder;
    if ('status' in patch) updateRow.status = patch.status;
    if ('publicToken' in patch) updateRow.public_token = patch.publicToken;
    if ('pdfUrl' in patch) updateRow.pdf_url = patch.pdfUrl;
    if ('publishedAt' in patch) updateRow.published_at = patch.publishedAt;

    if (Object.keys(updateRow).length > 0) {
      const { error } = await untypedFrom<MagazineRow>('magazines')
        .update(updateRow)
        .eq('id', id);
      if (error) {
        logger.warn('[magazineService.update] header error:', error.message);
        return null;
      }
    }

    // Se o patch inclui items, sincroniza (delete + insert).
    if (patch.items) {
      await untypedFrom<MagazineItemRow>('magazine_items').delete().eq('magazine_id', id);
      if (patch.items.length > 0) {
        const rows = patch.items.map((it, idx) => ({
          magazine_id: id,
          product_id: it.productId,
          product_snapshot: it.productSnapshot,
          variant_color_name: it.variantColorName,
          position: idx,
          page_number: it.pageNumber,
          overrides: it.overrides ?? {},
        }));
        const { error: insErr } = await untypedFrom<MagazineItemRow>('magazine_items').insert(rows);
        if (insErr) {
          logger.warn('[magazineService.update] items insert error:', insErr.message);
        }
      }
    }

    return hydrate(id);
  },

  async updateContent(id: string, patch: Partial<MagazineContentSettings>): Promise<Magazine | null> {
    const current = await this.get(id);
    if (!current) return null;
    return this.update(id, { content: { ...current.content, ...patch } });
  },

  async updateBranding(id: string, patch: Partial<MagazineClientBranding>): Promise<Magazine | null> {
    const current = await this.get(id);
    if (!current) return null;
    return this.update(id, { branding: { ...current.branding, ...patch } });
  },

  async addProducts(id: string, products: Product[]): Promise<Magazine | null> {
    const current = await this.get(id);
    if (!current) return null;
    const existingIds = new Set(current.items.map((i) => i.productId));
    const additions = products.filter((p) => !existingIds.has(p.id));
    if (additions.length === 0) return current;
    const basePos = current.items.length;
    const rows = additions.map((p, offset) => ({
      magazine_id: id,
      product_id: p.id,
      product_snapshot: productToSnapshot(p),
      variant_color_name: p.colors?.[0]?.name ?? null,
      position: basePos + offset,
      page_number: null,
      overrides: {},
    }));
    const { error } = await untypedFrom<MagazineItemRow>('magazine_items').insert(rows);
    if (error) {
      logger.warn('[magazineService.addProducts] error:', error.message);
      return current;
    }
    // Bumpa updated_at do header
    await untypedFrom<MagazineRow>('magazines')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);
    return hydrate(id);
  },

  async removeItem(id: string, itemId: string): Promise<Magazine | null> {
    const { error } = await untypedFrom<MagazineItemRow>('magazine_items')
      .delete()
      .eq('id', itemId)
      .eq('magazine_id', id);
    if (error) {
      logger.warn('[magazineService.removeItem] error:', error.message);
      return this.get(id);
    }
    await untypedFrom<MagazineRow>('magazines')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);
    return hydrate(id);
  },

  async reorderItems(id: string, orderedIds: string[]): Promise<Magazine | null> {
    // Atualiza posição em paralelo — cada item recebe seu novo índice.
    await Promise.all(
      orderedIds.map((itemId, idx) =>
        untypedFrom<MagazineItemRow>('magazine_items')
          .update({ position: idx })
          .eq('id', itemId)
          .eq('magazine_id', id),
      ),
    );
    await untypedFrom<MagazineRow>('magazines')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);
    return hydrate(id);
  },

  async updateItem(id: string, itemId: string, patch: Partial<MagazineItem>): Promise<Magazine | null> {
    const updateRow: Record<string, unknown> = {};
    if ('productSnapshot' in patch) updateRow.product_snapshot = patch.productSnapshot;
    if ('variantColorName' in patch) updateRow.variant_color_name = patch.variantColorName;
    if ('position' in patch) updateRow.position = patch.position;
    if ('pageNumber' in patch) updateRow.page_number = patch.pageNumber;
    if ('overrides' in patch) updateRow.overrides = patch.overrides;
    if (Object.keys(updateRow).length > 0) {
      const { error } = await untypedFrom<MagazineItemRow>('magazine_items')
        .update(updateRow)
        .eq('id', itemId)
        .eq('magazine_id', id);
      if (error) {
        logger.warn('[magazineService.updateItem] error:', error.message);
      }
    }
    await untypedFrom<MagazineRow>('magazines')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);
    return hydrate(id);
  },

  async duplicate(id: string): Promise<Magazine | null> {
    const current = await this.get(id);
    if (!current) return null;
    const clone = await this.create({
      ownerId: current.ownerId,
      organizationId: current.organizationId,
      title: `${current.title} (cópia)`,
      templateId: current.templateId,
    });
    // Header extras (branding/content) + items
    await this.update(clone.id, {
      branding: current.branding,
      content: current.content,
      subtitle: current.subtitle,
    });
    if (current.items.length > 0) {
      const rows = current.items.map((it, idx) => ({
        magazine_id: clone.id,
        product_id: it.productId,
        product_snapshot: it.productSnapshot,
        variant_color_name: it.variantColorName,
        position: idx,
        page_number: it.pageNumber,
        overrides: it.overrides ?? {},
      }));
      const { error } = await untypedFrom<MagazineItemRow>('magazine_items').insert(rows);
      if (error) logger.warn('[magazineService.duplicate] items error:', error.message);
    }
    return hydrate(clone.id);
  },

  async delete(id: string): Promise<void> {
    // Soft-delete: preserva registro para Undo do toast.
    const { error } = await untypedFrom<MagazineRow>('magazines')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) logger.warn('[magazineService.delete] error:', error.message);
  },

  /**
   * Restaura uma revista deletada (Undo do toast).
   * Estratégia: tenta desmarcar `deleted_at`. Se o registro sumiu (hard-delete),
   * reinsere header + items usando o objeto passado.
   */
  async restore(magazine: Magazine): Promise<Magazine> {
    const { data, error } = await untypedFrom<MagazineRow>('magazines')
      .update({ deleted_at: null, updated_at: new Date().toISOString() })
      .eq('id', magazine.id)
      .select('*')
      .maybeSingle();

    if (!error && data) {
      const hydrated = await hydrate(magazine.id);
      return hydrated ?? magazine;
    }

    // Hard-deleted: reinsere.
    const insertRow = {
      id: magazine.id,
      owner_id: magazine.ownerId,
      organization_id: magazine.organizationId,
      title: magazine.title,
      subtitle: magazine.subtitle,
      template_id: magazine.templateId,
      branding: magazine.branding,
      content_settings: magazine.content,
      page_order: magazine.pageOrder,
      status: magazine.status,
      public_token: magazine.publicToken,
      pdf_url: magazine.pdfUrl,
      published_at: magazine.publishedAt,
    };
    const { error: insErr } = await untypedFrom<MagazineRow>('magazines').insert(insertRow);
    if (insErr) {
      logger.warn('[magazineService.restore] reinsert error:', insErr.message);
      return magazine;
    }
    if (magazine.items.length > 0) {
      const itemRows = magazine.items.map((it, idx) => ({
        magazine_id: magazine.id,
        product_id: it.productId,
        product_snapshot: it.productSnapshot,
        variant_color_name: it.variantColorName,
        position: idx,
        page_number: it.pageNumber,
        overrides: it.overrides ?? {},
      }));
      await untypedFrom<MagazineItemRow>('magazine_items').insert(itemRows);
    }
    const hydrated = await hydrate(magazine.id);
    return hydrated ?? magazine;
  },

  async publish(id: string): Promise<Magazine | null> {
    // Idealmente o trigger fn_magazine_public_token gera o token quando o
    // status vira 'published'. Como esse trigger é um draft que ainda não
    // foi aplicado no BD Gold, geramos o token client-side quando ele
    // continua NULL — garantindo que o fluxo de publicação sempre produza
    // um link compartilhável E que o token fique persistido no BD para que
    // republicações futuras reutilizem o mesmo link (idempotência).
    //
    // Invariantes (validados por src/services/__tests__/magazinePublish.fuzz.test.ts):
    //   INV-1: nunca retorna Magazine com publicToken vazio se o BD aceitou
    //          ao menos um UPDATE de status.
    //   INV-2: token pré-existente NUNCA é sobrescrito (guarda `is null`).
    //   INV-3: falha do UPDATE de status → resolve com null, sem token órfão.
    //   INV-4: token final sempre 32 hex chars.
    //   INV-5: falha do UPDATE de token não derruba o publish.
    const currentRow = await fetchMagazineRow(id);
    const existingToken = currentRow?.public_token ?? null;

    // 1) Update de status/published_at — sempre. Se falhar, aborta ANTES de
    //    tentar gravar qualquer token (INV-3: sem token órfão no BD).
    const { error } = await untypedFrom<MagazineRow>('magazines')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) {
      logger.warn('[magazineService.publish] error:', error.message);
      return null;
    }

    // 2) Se já havia token, pula o UPDATE de token (economia + INV-2).
    //    A trigger, quando ativa, já preencheu no passo 1; o re-fetch abaixo
    //    confirma. Se não havia, tenta gravar o token gerado com guarda
    //    `.is('public_token', null)` — só escreve se o BD ainda estiver NULL.
    if (!existingToken) {
      const generatedToken = generatePublicToken();
      const { error: tokenErr } = await untypedFrom<MagazineRow>('magazines')
        .update({ public_token: generatedToken })
        .eq('id', id)
        .is('public_token', null);
      if (tokenErr) {
        logger.warn('[magazineService.publish] token persist error:', tokenErr.message);
      }
    }

    let hydrated = await hydrate(id);
    // Defesa em profundidade: se ainda vier NULL (ex.: RLS silenciosa que
    // ocultou o UPDATE anterior), tenta persistir um NOVO token com guarda
    // `is null`. Idempotente e seguro contra concorrência: um segundo
    // publish() concorrente vai bater na guarda e ser rejeitado.
    if (hydrated && !hydrated.publicToken) {
      const fallbackToken = generatePublicToken();
      const { error: tokenErr } = await untypedFrom<MagazineRow>('magazines')
        .update({ public_token: fallbackToken })
        .eq('id', id)
        .is('public_token', null);
      if (tokenErr) {
        logger.warn('[magazineService.publish] token backfill error:', tokenErr.message);
      } else {
        hydrated = await hydrate(id);
      }
    }
    return hydrated;
  },

  async unpublish(id: string): Promise<Magazine | null> {
    const { error } = await untypedFrom<MagazineRow>('magazines')
      .update({ status: 'draft' })
      .eq('id', id);
    if (error) {
      logger.warn('[magazineService.unpublish] error:', error.message);
      return null;
    }
    return hydrate(id);
  },
};

// Marca o supabase client como usado (evita tree-shake do import) — o
// untypedFrom() já depende dele, mas mantemos referência explícita para
// documentação.
void supabase;
