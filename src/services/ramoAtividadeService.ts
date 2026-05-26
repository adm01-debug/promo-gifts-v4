import { supabase } from '@/integrations/supabase/client';
import type {
  RamoAtividade,
  RamoAtividadeFilho,
  RamoAtividadeGroup,
  SegmentoComplete,
} from '@/types/ramo-atividade';

// Service para chamadas à API de Ramos de Atividade (banco externo)
class RamoAtividadeService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/external-db-bridge`;
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
  }

  private async callApi<T>(
    table: string,
    operation: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    const headers = await this.getAuthHeaders();

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ table, operation, ...params }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result?.error || 'Erro ao acessar ramos de atividade');
    }

    if (result?.success === false) {
      throw new Error(result?.error || 'Erro ao acessar ramos de atividade');
    }

    return (result?.data ?? result) as T;
  }

  // ============================================================
  // RAMOS DE ATIVIDADE (Categorias Pai)
  // ============================================================

  // Buscar todos os ramos de atividade
  async getRamos(apenasAtivos = true): Promise<{ ramos: RamoAtividade[]; count: number }> {
    const filters = apenasAtivos ? { ativo: true } : {};
    const res = await this.callApi<{ records: RamoAtividade[]; count: number }>(
      'ramo_atividade',
      'select',
      {
        filters,
        orderBy: { column: 'ordem', ascending: true },
      },
    );

    return {
      ramos: res.records || [],
      count: res.count ?? (res.records?.length || 0),
    };
  }

  // Buscar ramos com estatísticas (convertido para formato similar ao MaterialGroup)
  async getRamosComEstatisticas(): Promise<{ groups: RamoAtividadeGroup[]; count: number }> {
    // Buscar ramos
    const { ramos } = await this.getRamos(false);

    // Buscar todos os segmentos para contar
    const { segmentos } = await this.getSegmentos(false);

    // Contar segmentos por ramo
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

  // Buscar ramo por ID
  async getRamoById(id: string): Promise<RamoAtividade | null> {
    const res = await this.callApi<{ records: RamoAtividade[] }>('ramo_atividade', 'select', {
      id,
    });
    return res.records?.[0] || null;
  }

  // Criar ramo
  async createRamo(data: Partial<RamoAtividade>): Promise<RamoAtividade> {
    const res = await this.callApi<RamoAtividade>('ramo_atividade', 'insert', { data });
    return res;
  }

  // Atualizar ramo
  async updateRamo(id: string, data: Partial<RamoAtividade>): Promise<RamoAtividade> {
    const res = await this.callApi<RamoAtividade>('ramo_atividade', 'update', { id, data });
    return res;
  }

  // Deletar ramo
  async deleteRamo(id: string): Promise<void> {
    await this.callApi('ramo_atividade', 'delete', { id });
  }

  // ============================================================
  // RAMOS DE ATIVIDADE FILHOS (Segmentos)
  // ============================================================

  // Buscar todos os segmentos
  async getSegmentos(
    apenasAtivos = true,
  ): Promise<{ segmentos: RamoAtividadeFilho[]; count: number }> {
    const filters = apenasAtivos ? { ativo: true } : {};
    const res = await this.callApi<{ records: RamoAtividadeFilho[]; count: number }>(
      'ramo_atividade_filho',
      'select',
      {
        filters,
        orderBy: { column: 'ordem', ascending: true },
      },
    );

    return {
      segmentos: res.records || [],
      count: res.count ?? (res.records?.length || 0),
    };
  }

  // Buscar segmentos por ramo pai
  async getSegmentosPorRamo(
    ramoId: string,
    apenasAtivos = true,
  ): Promise<{ segmentos: RamoAtividadeFilho[]; count: number }> {
    const filters: Record<string, unknown> = { ramo_atividade_id: ramoId };
    if (apenasAtivos) {
      filters.ativo = true;
    }

    const res = await this.callApi<{ records: RamoAtividadeFilho[]; count: number }>(
      'ramo_atividade_filho',
      'select',
      {
        filters,
        orderBy: { column: 'ordem', ascending: true },
      },
    );

    return {
      segmentos: res.records || [],
      count: res.count ?? (res.records?.length || 0),
    };
  }

  // Buscar segmentos completos (com dados do pai - similar ao MaterialComplete)
  async getSegmentosCompletos(): Promise<{ segmentos: SegmentoComplete[]; count: number }> {
    // Buscar ramos e segmentos
    const [{ ramos }, { segmentos }] = await Promise.all([
      this.getRamos(true),
      this.getSegmentos(true),
    ]);

    // Criar mapa de ramos
    const ramoMap = new Map(ramos.map((r) => [r.id, r]));

    // Combinar dados
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

  // Buscar segmento por ID
  async getSegmentoById(id: string): Promise<RamoAtividadeFilho | null> {
    const res = await this.callApi<{ records: RamoAtividadeFilho[] }>(
      'ramo_atividade_filho',
      'select',
      { id },
    );
    return res.records?.[0] || null;
  }

  // Criar segmento
  async createSegmento(data: Partial<RamoAtividadeFilho>): Promise<RamoAtividadeFilho> {
    const res = await this.callApi<RamoAtividadeFilho>('ramo_atividade_filho', 'insert', { data });
    return res;
  }

  // Atualizar segmento
  async updateSegmento(id: string, data: Partial<RamoAtividadeFilho>): Promise<RamoAtividadeFilho> {
    const res = await this.callApi<RamoAtividadeFilho>('ramo_atividade_filho', 'update', {
      id,
      data,
    });
    return res;
  }

  // Deletar segmento
  async deleteSegmento(id: string): Promise<void> {
    await this.callApi('ramo_atividade_filho', 'delete', { id });
  }

  // ============================================================
  // ASSOCIAÇÕES PRODUTO ↔ RAMO DE ATIVIDADE
  // ============================================================

  // Buscar ramos de um produto
  async getRamosDoProduto(
    produtoId: string,
  ): Promise<{ associacoes: { id: string; ramo_atividade_filho_id: string }[]; count: number }> {
    const res = await this.callApi<{
      records: { id: string; ramo_atividade_filho_id: string }[];
      count: number;
    }>('produto_ramo_atividade', 'select', {
      filters: { produto_id: produtoId },
    });

    return {
      associacoes: res.records || [],
      count: res.count ?? (res.records?.length || 0),
    };
  }

  // Adicionar ramo a um produto
  async addRamoAoProduto(produtoId: string, segmentoId: string): Promise<void> {
    await this.callApi('produto_ramo_atividade', 'insert', {
      data: {
        produto_id: produtoId,
        ramo_atividade_filho_id: segmentoId,
      },
    });
  }

  // Remover ramo de um produto (busca o ID primeiro)
  async removeRamoDoProduto(produtoId: string, segmentoId: string): Promise<void> {
    // Primeiro buscar a associação
    const { associacoes } = await this.getRamosDoProduto(produtoId);
    const assoc = associacoes.find((a) => a.ramo_atividade_filho_id === segmentoId);

    if (assoc) {
      await this.callApi('produto_ramo_atividade', 'delete', { id: assoc.id });
    }
  }

  // Atualizar todos os ramos de um produto
  async updateRamosDoProduto(produtoId: string, segmentoIds: string[]): Promise<void> {
    // Buscar associações atuais
    const { associacoes } = await this.getRamosDoProduto(produtoId);
    const currentIds = associacoes.map((a) => a.ramo_atividade_filho_id);

    // Calcular diferenças
    const toAdd = segmentoIds.filter((id) => !currentIds.includes(id));
    const toRemove = associacoes.filter((a) => !segmentoIds.includes(a.ramo_atividade_filho_id));

    // Executar operações
    await Promise.all([
      ...toAdd.map((segId) => this.addRamoAoProduto(produtoId, segId)),
      ...toRemove.map((assoc) =>
        this.callApi('produto_ramo_atividade', 'delete', { id: assoc.id }),
      ),
    ]);
  }
}

export const ramoAtividadeService = new RamoAtividadeService();
