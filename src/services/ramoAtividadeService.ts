import { supabase } from '@/integrations/supabase/client';
import type {
  RamoAtividade,
  RamoAtividadeFilho,
  RamoAtividadeGroup,
  SegmentoComplete,
} from '@/types/ramo-atividade';

// Service para Ramos de Atividade.
//
// Migrado de `external-db-bridge` (Edge Function) para PostgREST nativo via
// supabase client. A Edge Function foi descontinuada e responde HTTP 410 Gone;
// alem disso o fetch manual montava a URL com import.meta.env.VITE_SUPABASE_URL,
// que era undefined em builds sem env (ex.: preview Lovable) -> `/undefined/...`.
//
// Acesso controlado por RLS:
//   - leitura: anon + authenticated (catalogo publico)
//   - escrita: admin autenticado (is_admin_or_above)
//
// `as never` no nome da tabela / payload segue o padrao do codebase para
// tabelas resolvidas em runtime (o supabase client e tipado por literais).
type SelectParams = {
  id?: string;
  filters?: Record<string, unknown>;
  orderBy?: { column: string; ascending: boolean };
};

class RamoAtividadeService {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  private async select<T>(
    table: string,
    params: SelectParams = {},
  ): Promise<{ records: T[]; count: number }> {
    let query = supabase.from(table as never).select('*', { count: 'exact' });

    if (params.id) {
      query = query.eq('id', params.id);
    }
    if (params.filters) {
      for (const [key, value] of Object.entries(params.filters)) {
        query = query.eq(key, value as never);
      }
    }
    if (params.orderBy) {
      query = query.order(params.orderBy.column, { ascending: params.orderBy.ascending });
    }

    const { data, error, count } = await query;
    if (error) throw new Error(error.message || 'Erro ao acessar ramos de atividade');

    const records = (data ?? []) as unknown as T[];
    return { records, count: count ?? records.length };
  }

  private async insertRow<T>(table: string, data: Record<string, unknown>): Promise<T> {
    const { data: row, error } = await supabase
      .from(table as never)
      .insert(data as never)
      .select()
      .single();
    if (error) throw new Error(error.message || 'Erro ao criar registro');
    return row;
  }

  private async updateRow<T>(table: string, id: string, data: Record<string, unknown>): Promise<T> {
    const { data: row, error } = await supabase
      .from(table as never)
      .update(data as never)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message || 'Erro ao atualizar registro');
    return row;
  }

  private async deleteRow(table: string, id: string): Promise<void> {
    const { error } = await supabase
      .from(table as never)
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message || 'Erro ao remover registro');
  }

  // ============================================================
  // RAMOS DE ATIVIDADE (Categorias Pai)
  // ============================================================

  async getRamos(apenasAtivos = true): Promise<{ ramos: RamoAtividade[]; count: number }> {
    const filters = apenasAtivos ? { ativo: true } : {};
    const { records, count } = await this.select<RamoAtividade>('ramo_atividade', {
      filters,
      orderBy: { column: 'ordem', ascending: true },
    });
    return { ramos: records, count };
  }

  async getRamosComEstatisticas(): Promise<{ groups: RamoAtividadeGroup[]; count: number }> {
    const { ramos } = await this.getRamos(false);
    const { segmentos } = await this.getSegmentos(false);

    const countByRamo = new Map<string, number>();
    segmentos.forEach((seg) => {
      const count = countByRamo.get(seg.ramo_atividade_id) || 0;
      countByRamo.set(seg.ramo_atividade_id, count + 1);
    });

    const groups: RamoAtividadeGroup[] = ramos.map((ramo) => ({
      group_id: ramo.id,
      group_name: ramo.nome,
      group_slug: ramo.slug,
      group_description: ramo.descricao || null,
      group_hex_code: ramo.cor || null,
      group_icon: ramo.icone || null,
      display_order: ramo.ordem,
      total_segmentos: countByRamo.get(ramo.id) || 0,
    }));

    return { groups, count: groups.length };
  }

  async getRamoById(id: string): Promise<RamoAtividade | null> {
    const { records } = await this.select<RamoAtividade>('ramo_atividade', { id });
    return records[0] || null;
  }

  async createRamo(data: Partial<RamoAtividade>): Promise<RamoAtividade> {
    return this.insertRow<RamoAtividade>('ramo_atividade', data);
  }

  async updateRamo(id: string, data: Partial<RamoAtividade>): Promise<RamoAtividade> {
    return this.updateRow<RamoAtividade>('ramo_atividade', id, data);
  }

  async deleteRamo(id: string): Promise<void> {
    await this.deleteRow('ramo_atividade', id);
  }

  // ============================================================
  // RAMOS DE ATIVIDADE FILHOS (Segmentos)
  // ============================================================

  async getSegmentos(
    apenasAtivos = true,
  ): Promise<{ segmentos: RamoAtividadeFilho[]; count: number }> {
    const filters = apenasAtivos ? { ativo: true } : {};
    const { records, count } = await this.select<RamoAtividadeFilho>('ramo_atividade_filho', {
      filters,
      orderBy: { column: 'ordem', ascending: true },
    });
    return { segmentos: records, count };
  }

  async getSegmentosPorRamo(
    ramoId: string,
    apenasAtivos = true,
  ): Promise<{ segmentos: RamoAtividadeFilho[]; count: number }> {
    const filters: Record<string, unknown> = { ramo_atividade_id: ramoId };
    if (apenasAtivos) {
      filters.ativo = true;
    }
    const { records, count } = await this.select<RamoAtividadeFilho>('ramo_atividade_filho', {
      filters,
      orderBy: { column: 'ordem', ascending: true },
    });
    return { segmentos: records, count };
  }

  async getSegmentosCompletos(): Promise<{ segmentos: SegmentoComplete[]; count: number }> {
    const [{ ramos }, { segmentos }] = await Promise.all([
      this.getRamos(true),
      this.getSegmentos(true),
    ]);

    const ramoMap = new Map(ramos.map((r) => [r.id, r]));

    const segmentosCompletos: SegmentoComplete[] = segmentos
      .map((seg) => {
        const ramo = ramoMap.get(seg.ramo_atividade_id);
        if (!ramo) return null;

        return {
          segmento_id: seg.id,
          segmento_name: seg.nome,
          segmento_slug: seg.slug,
          segmento_description: seg.descricao || null,
          segmento_icon: seg.icone || null,
          segmento_display_order: seg.ordem,
          ramo_id: ramo.id,
          ramo_name: ramo.nome,
          ramo_slug: ramo.slug,
          ramo_description: ramo.descricao || null,
          ramo_hex_code: ramo.cor || null,
          ramo_icon: ramo.icone || null,
          ramo_display_order: ramo.ordem,
        };
      })
      .filter((s): s is SegmentoComplete => s !== null);

    return { segmentos: segmentosCompletos, count: segmentosCompletos.length };
  }

  async getSegmentoById(id: string): Promise<RamoAtividadeFilho | null> {
    const { records } = await this.select<RamoAtividadeFilho>('ramo_atividade_filho', { id });
    return records[0] || null;
  }

  async createSegmento(data: Partial<RamoAtividadeFilho>): Promise<RamoAtividadeFilho> {
    return this.insertRow<RamoAtividadeFilho>('ramo_atividade_filho', data);
  }

  async updateSegmento(id: string, data: Partial<RamoAtividadeFilho>): Promise<RamoAtividadeFilho> {
    return this.updateRow<RamoAtividadeFilho>('ramo_atividade_filho', id, data);
  }

  async deleteSegmento(id: string): Promise<void> {
    await this.deleteRow('ramo_atividade_filho', id);
  }

  // ============================================================
  // ASSOCIACOES PRODUTO <-> RAMO DE ATIVIDADE
  // ============================================================

  async getRamosDoProduto(produtoId: string): Promise<{
    associacoes: Array<{ id: string; ramo_atividade_filho_id: string }>;
    count: number;
  }> {
    const { records, count } = await this.select<{
      id: string;
      ramo_atividade_filho_id: string;
    }>('produto_ramo_atividade', {
      filters: { produto_id: produtoId },
    });
    return { associacoes: records, count };
  }

  async addRamoAoProduto(produtoId: string, segmentoId: string): Promise<void> {
    await this.insertRow('produto_ramo_atividade', {
      produto_id: produtoId,
      ramo_atividade_filho_id: segmentoId,
    });
  }

  async removeRamoDoProduto(produtoId: string, segmentoId: string): Promise<void> {
    const { associacoes } = await this.getRamosDoProduto(produtoId);
    const assoc = associacoes.find((a) => a.ramo_atividade_filho_id === segmentoId);
    if (assoc) {
      await this.deleteRow('produto_ramo_atividade', assoc.id);
    }
  }

  async updateRamosDoProduto(produtoId: string, segmentoIds: string[]): Promise<void> {
    const { associacoes } = await this.getRamosDoProduto(produtoId);
    const currentIds = associacoes.map((a) => a.ramo_atividade_filho_id);

    const toAdd = segmentoIds.filter((id) => !currentIds.includes(id));
    const toRemove = associacoes.filter((a) => !segmentoIds.includes(a.ramo_atividade_filho_id));

    await Promise.all([
      ...toAdd.map((segId) => this.addRamoAoProduto(produtoId, segId)),
      ...toRemove.map((assoc) => this.deleteRow('produto_ramo_atividade', assoc.id)),
    ]);
  }
}

export const ramoAtividadeService = new RamoAtividadeService();
