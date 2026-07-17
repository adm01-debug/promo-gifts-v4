/**
 * MagazineService — persistência v2 no BD Gold (doufsxqlfjyuvxuezpln).
 *
 * Migração 2026-07-12: substituído localStorage por chamadas Supabase
 * (tabelas `magazines`, `magazine_items`) + edge `magazine-public-view`
 * para leitura anônima. Toda a API passa a ser assíncrona.
 *
 * Migração 2026-07-16: queries convertidas para supabase.from() tipado
 * (docs/plans/magazine-typed-queries-migration.md). Campos Json do BD
 * (branding, content_settings, product_snapshot, overrides, page_order) são
 * mapeados via cast explícito nas funções de mapeamento.
 */

import { type Magazine, type MagazineClientBranding, type MagazineContentSettings, type MagazineItem, type MagazineProductSnapshot, type MagazineTemplateId, DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';
import { validateBranding } from '@/lib/security/magazine-guard';

import type { Product } from '@/types/product-catalog';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { newRequestId, REQUEST_ID_HEADER } from '@/lib/telemetry/requestId';

// ---------------------------------------------------------------------------
// Row shapes derivadas do schema tipado do BD Gold
// ---------------------------------------------------------------------------

type MagazineRow = Database['public']['Tables']['magazines']['Row'];
type MagazineItemRow = Database['public']['Tables']['magazine_items']['Row'];

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function rowToItem(row: MagazineItemRow): MagazineItem {
  return {
    id: row.id,
    productId: row.product_id,
    productSnapshot: row.product_snapshot as unknown as MagazineProductSnapshot,
    variantColorName: row.variant_color_name,
    position: row.position,
    pageNumber: row.page_number,
    overrides: (row.overrides ?? {}) as unknown as Partial<MagazineContentSettings>,
  };
}

function rowToMagazine(row: MagazineRow, items: MagazineItemRow[]): Magazine {
  return {
    id: row.id,
    ownerId: row.owner_id,
    organizationId: row.organization_id,
    title: row.title,
    subtitle: row.subtitle ?? '',
    templateId: row.template_id as MagazineTemplateId,
    branding: { ...DEFAULT_BRANDING, ...(row.branding as unknown as MagazineClientBranding ?? {}) },
    content: { ...DEFAULT_MAGAZINE_CONTENT, ...(row.content_settings as unknown as MagazineContentSettings ?? {}) },
    items: [...items].sort((a, b) => a.position - b.position).map(rowToItem),
    pageOrder: row.page_order as number[] | null,
    status: row.status,
    publicToken: row.public_token,
    viewCount: row.view_count ?? 0,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
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
  const { data, error } = await supabase
    .from('magazines')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    logger.warn('[magazineService] fetchMagazineRow error:', error.message);
    return null;
  }
  return data ?? null;
}

async function fetchItems(magazineId: string): Promise<MagazineItemRow[]> {
  const { data, error } = await supabase
    .from('magazine_items')
    .select('*')
    .eq('magazine_id', magazineId)
    .order('position', { ascending: true });
  if (error) {
    logger.warn('[magazineService] fetchItems error:', error.message);
    return [];
  }
  return data ?? [];
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
    viewCount: 0,
    publishedAt: null,
    archivedAt: null,
    createdAt: '',
    updatedAt: '',
  };
}

// ---------------------------------------------------------------------------
// Service API (async)
// ---------------------------------------------------------------------------

export const magazineService = {
  async list(ownerId: string): Promise<Magazine[]> {
    const { data, error } = await supabase
      .from('magazines')
      .select('*')
      .eq('owner_id', ownerId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (error) {
      logger.warn('[magazineService.list] error:', error.message);
      return [];
    }
    const rows: MagazineRow[] = data ?? [];
    if (rows.length === 0) return [];
    // Busca items de todas as revistas em uma query só
    const ids = rows.map((r) => r.id);
    const { data: itemsData } = await supabase
      .from('magazine_items')
      .select('*')
      .in('magazine_id', ids);
    const items = itemsData ?? [];
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
    const { data, error } = await supabase
      .from('magazines')
      .insert(insertRow)
      .select('*')
      .single();
    if (error || !data) {
      throw new Error(`[magazineService.create] ${error?.message ?? 'insert falhou'}`);
    }
    return rowToMagazine(data, []);
  },

  async update(id: string, patch: Partial<Magazine>): Promise<Magazine | null> {
    type MagazineUpdate = Database['public']['Tables']['magazines']['Update'];
    const updateRow: MagazineUpdate = {};
    if ('title' in patch) updateRow.title = patch.title;
    if ('subtitle' in patch) updateRow.subtitle = patch.subtitle;
    if ('templateId' in patch) updateRow.template_id = patch.templateId;
    if ('branding' in patch) updateRow.branding = patch.branding as unknown as MagazineUpdate['branding'];
    if ('content' in patch) updateRow.content_settings = patch.content as unknown as MagazineUpdate['content_settings'];
    if ('pageOrder' in patch) updateRow.page_order = patch.pageOrder as unknown as MagazineUpdate['page_order'];
    if ('status' in patch) updateRow.status = patch.status;
    if ('publicToken' in patch) updateRow.public_token = patch.publicToken;
    if ('publishedAt' in patch) updateRow.published_at = patch.publishedAt;

    if (Object.keys(updateRow).length > 0) {
      const { error } = await supabase
        .from('magazines')
        .update(updateRow)
        .eq('id', id);
      if (error) {
        logger.warn('[magazineService.update] header error:', error.message);
        return null;
      }
    }

    // CRIT-6: Array.isArray guard — `if (patch.items)` is truthy for [], which
    // would delete all items and then insert nothing, silently wiping the list.
    // CRIT-5: delete result is checked — insert failure after successful delete
    // returned a Magazine with items=[] (data loss); now we return null so the
    // caller knows the operation failed.
    if (Array.isArray(patch.items)) {
      const { error: delErr } = await supabase.from('magazine_items').delete().eq('magazine_id', id);
      if (delErr) {
        logger.warn('[magazineService.update] items delete error:', delErr.message);
        return null;
      }
      if (patch.items.length > 0) {
        const rows = patch.items.map((it, idx) => ({
          magazine_id: id,
          product_id: it.productId,
          product_snapshot: it.productSnapshot as unknown as Database['public']['Tables']['magazine_items']['Insert']['product_snapshot'],
          variant_color_name: it.variantColorName,
          position: idx,
          page_number: it.pageNumber,
          overrides: (it.overrides ?? {}) as unknown as Database['public']['Tables']['magazine_items']['Insert']['overrides'],
        }));
        const { error: insErr } = await supabase.from('magazine_items').insert(rows);
        if (insErr) {
          logger.warn('[magazineService.update] items insert error:', insErr.message);
          return null;
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
    // Deep-merge colors so a partial patch ({ colors: { primary } }) or
    // DB-deserialized branding with missing keys does not silently drop
    // secondary/text (shallow spread would overwrite the whole colors object).
    const merged = {
      ...current.branding,
      ...patch,
      colors: patch.colors
        ? { ...current.branding.colors, ...patch.colors }
        : current.branding.colors,
    };
    const { isValid, sanitized } = validateBranding(merged);
    if (!isValid) {
      logger.warn('[magazineService.updateBranding] rejected invalid branding');
      return null;
    }
    return this.update(id, { branding: { ...merged, ...sanitized } });
  },

  async addProducts(id: string, products: Product[]): Promise<Magazine | null> {
    const current = await this.get(id);
    if (!current) return null;
    const existingIds = new Set(current.items.map((i) => i.productId));
    const additions = products.filter((p) => !existingIds.has(p.id));
    if (additions.length === 0) return current;
    // CRIT-4: Use max(position) + 1 instead of items.length to avoid position
    // collisions after any removeItem creates gaps in the position sequence.
    const basePos = current.items.length === 0
      ? 0
      : Math.max(...current.items.map((i) => i.position ?? 0)) + 1;
    const rows = additions.map((p, offset) => ({
      magazine_id: id,
      product_id: p.id,
      product_snapshot: productToSnapshot(p) as unknown as Database['public']['Tables']['magazine_items']['Insert']['product_snapshot'],
      variant_color_name: p.colors?.[0]?.name ?? null,
      position: basePos + offset,
      page_number: null,
      overrides: {} as unknown as Database['public']['Tables']['magazine_items']['Insert']['overrides'],
    }));
    const { error } = await supabase.from('magazine_items').insert(rows);
    if (error) {
      // MED-8: return null on insert failure — returning `current` falsely
      // implied success while the products were never actually persisted.
      logger.warn('[magazineService.addProducts] error:', error.message);
      return null;
    }
    // Bumpa updated_at do header
    await supabase
      .from('magazines')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);
    return hydrate(id);
  },

  async removeItem(id: string, itemId: string): Promise<Magazine | null> {
    const { error } = await supabase
      .from('magazine_items')
      .delete()
      .eq('id', itemId)
      .eq('magazine_id', id);
    if (error) {
      // MED-5: return null on delete failure — returning this.get(id) falsely
      // implied the item was removed while it was still in the DB.
      logger.warn('[magazineService.removeItem] error:', error.message);
      return null;
    }
    await supabase
      .from('magazines')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);
    return hydrate(id);
  },

  async reorderItems(id: string, orderedIds: string[]): Promise<Magazine | null> {
    // Atualiza posição em paralelo — cada item recebe seu novo índice.
    const results = await Promise.all(
      orderedIds.map((itemId, idx) =>
        supabase
          .from('magazine_items')
          .update({ position: idx })
          .eq('id', itemId)
          .eq('magazine_id', id),
      ),
    );
    const anyFailed = results.some((r) => r.error !== null);
    if (anyFailed) {
      const firstError = results.find((r) => r.error)?.error;
      logger.warn('[magazineService.reorderItems] partial failure:', firstError?.message);
      return null;
    }
    await supabase
      .from('magazines')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);
    return hydrate(id);
  },

  async updateItem(id: string, itemId: string, patch: Partial<MagazineItem>): Promise<Magazine | null> {
    type MagazineItemUpdate = Database['public']['Tables']['magazine_items']['Update'];
    const updateRow: MagazineItemUpdate = {};
    if ('productSnapshot' in patch) updateRow.product_snapshot = patch.productSnapshot as unknown as MagazineItemUpdate['product_snapshot'];
    if ('variantColorName' in patch) updateRow.variant_color_name = patch.variantColorName;
    if ('position' in patch) updateRow.position = patch.position;
    if ('pageNumber' in patch) updateRow.page_number = patch.pageNumber;
    if ('overrides' in patch) updateRow.overrides = patch.overrides as unknown as MagazineItemUpdate['overrides'];
    if (Object.keys(updateRow).length > 0) {
      const { error } = await supabase
        .from('magazine_items')
        .update(updateRow)
        .eq('id', itemId)
        .eq('magazine_id', id);
      if (error) {
        logger.warn('[magazineService.updateItem] error:', error.message);
        return null;
      }
    }
    await supabase
      .from('magazines')
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
    // Header extras (branding/content) + items.
    // Validate branding before copying so that old corrupt payloads (pre-audit)
    // are sanitized rather than silently propagated to the duplicate.
    const { sanitized: safeBranding } = validateBranding(current.branding);
    await this.update(clone.id, {
      branding: safeBranding
        ? { ...(current.branding as MagazineClientBranding), ...safeBranding }
        : (current.branding as MagazineClientBranding),
      content: current.content,
      subtitle: current.subtitle,
    });
    if (current.items.length > 0) {
      const rows = current.items.map((it, idx) => ({
        magazine_id: clone.id,
        product_id: it.productId,
        product_snapshot: it.productSnapshot as unknown as Database['public']['Tables']['magazine_items']['Insert']['product_snapshot'],
        variant_color_name: it.variantColorName,
        position: idx,
        page_number: it.pageNumber,
        overrides: (it.overrides ?? {}) as unknown as Database['public']['Tables']['magazine_items']['Insert']['overrides'],
      }));
      const { error } = await supabase.from('magazine_items').insert(rows);
      if (error) logger.warn('[magazineService.duplicate] items error:', error.message);
    }
    return hydrate(clone.id);
  },

  async delete(id: string): Promise<void> {
    // Soft-delete: preserva registro para Undo do toast.
    const { error } = await supabase
      .from('magazines')
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
    const { data, error } = await supabase
      .from('magazines')
      .update({ deleted_at: null, updated_at: new Date().toISOString() })
      .eq('id', magazine.id)
      .select('*')
      .maybeSingle();

    if (!error && data) {
      const hydrated = await hydrate(magazine.id);
      return hydrated ?? magazine;
    }

    // Hard-deleted: reinsere.
    type MagazineInsert = Database['public']['Tables']['magazines']['Insert'];
    const insertRow: MagazineInsert = {
      id: magazine.id,
      owner_id: magazine.ownerId,
      organization_id: magazine.organizationId,
      title: magazine.title,
      subtitle: magazine.subtitle,
      template_id: magazine.templateId,
      branding: magazine.branding as unknown as MagazineInsert['branding'],
      content_settings: magazine.content as unknown as MagazineInsert['content_settings'],
      page_order: magazine.pageOrder as unknown as MagazineInsert['page_order'],
      status: magazine.status,
      public_token: magazine.publicToken,
      published_at: magazine.publishedAt,
    };
    const { error: insErr } = await supabase.from('magazines').insert(insertRow);
    if (insErr) {
      logger.warn('[magazineService.restore] reinsert error:', insErr.message);
      return magazine;
    }
    if (magazine.items.length > 0) {
      const itemRows = magazine.items.map((it, idx) => ({
        magazine_id: magazine.id,
        product_id: it.productId,
        product_snapshot: it.productSnapshot as unknown as Database['public']['Tables']['magazine_items']['Insert']['product_snapshot'],
        variant_color_name: it.variantColorName,
        position: idx,
        page_number: it.pageNumber,
        overrides: (it.overrides ?? {}) as unknown as Database['public']['Tables']['magazine_items']['Insert']['overrides'],
      }));
      const { error: itemsErr } = await supabase.from('magazine_items').insert(itemRows);
      if (itemsErr) {
        logger.warn('[magazineService.restore] items reinsert error:', itemsErr.message);
        // Compensating rollback: soft-delete the header we just inserted to
        // avoid an orphan magazine (header in DB with zero items).
        await supabase
          .from('magazines')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', magazine.id);
        return magazine; // stale object — caller can retry
      }
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
    // MED-10: guard deleted_at IS NULL so a soft-deleted magazine cannot be
    // re-published without first restoring it (avoids phantom published rows).
    const { error } = await supabase
      .from('magazines')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null);
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
      const { error: tokenErr } = await supabase
        .from('magazines')
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
      const { error: tokenErr } = await supabase
        .from('magazines')
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
    // MED-14: also clear public_token so the shared link stops resolving —
    // unpublishing without nulling the token left the magazine publicly readable.
    const { error } = await supabase
      .from('magazines')
      .update({ status: 'draft', public_token: null })
      .eq('id', id);
    if (error) {
      logger.warn('[magazineService.unpublish] error:', error.message);
      return null;
    }
    return hydrate(id);
  },
};

