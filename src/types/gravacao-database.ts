/**
 * Types: Gravação Database
 *
 * Tipos para o banco de dados externo de Gravação (Promobrind).
 * Mantido para compatibilidade com código legado.
 */

// Re-export dos tipos de infraestrutura
export type {
  TipoSetup,
  FormatoVariante,
  TipoIntegracao,
  TecnicaGravacaoRaw,
  TecnicaGravacaoVarianteRaw,
  FornecedorGravacaoRaw,
  TecnicaFaixaAreaRaw,
  TecnicaFaixaPontosRaw,
  HotStampingFitaOpcaoRaw,
  LaserAcabamentoOpcaoRaw,
  TecnicaTipoFilmeRaw,
} from './infrastructure';

// Aliases para compatibilidade
import type {
  TecnicaGravacaoRaw,
  TecnicaGravacaoVarianteRaw,
  FornecedorGravacaoRaw,
  TecnicaFaixaAreaRaw,
  TecnicaFaixaPontosRaw,
  HotStampingFitaOpcaoRaw,
  LaserAcabamentoOpcaoRaw,
  TecnicaTipoFilmeRaw,
  TipoSetup,
  FormatoVariante,
} from './infrastructure';

// ============================================
// ALIASES LEGADOS
// ============================================

export type TecnicaGravacao = TecnicaGravacaoRaw;
export type TecnicaGravacaoVariante = TecnicaGravacaoVarianteRaw;
export type FornecedorGravacao = FornecedorGravacaoRaw;
export type TecnicaFaixaArea = TecnicaFaixaAreaRaw;
export type TecnicaFaixaPontos = TecnicaFaixaPontosRaw;
export type HotStampingFitaOpcao = HotStampingFitaOpcaoRaw;
export type LaserAcabamentoOpcao = LaserAcabamentoOpcaoRaw;
export type TecnicaTipoFilme = TecnicaTipoFilmeRaw;

// ============================================
// TIPOS COMPOSTOS
// ============================================

export interface TecnicaGravacaoWithVariantes extends TecnicaGravacaoRaw {
  variantes: TecnicaGravacaoVarianteRaw[];
  variantes_count?: number;
}

// ============================================
// JSON TYPE
// ============================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ============================================
// FORMULÁRIOS
// ============================================

export interface TecnicaGravacaoFormData {
  codigo: string;
  codigo_interno: string;
  nome: string;
  descricao: string;
  permite_cores: boolean;
  max_cores: number;
  cobra_por_cor: boolean;
  cobra_por_area: boolean;
  cobra_por_pontos: boolean;
  requer_setup: boolean;
  tipo_setup: TipoSetup;
  tempo_producao_dias: number;
  ordem_exibicao: number;
  ativo: boolean;
}

export interface VarianteFormData {
  tecnica_gravacao_id: string;
  codigo: string;
  codigo_interno: string;
  nome: string;
  descricao: string;
  formato: FormatoVariante;
  permite_cores: boolean;
  max_cores: number;
  cobra_por_cor: boolean;
  produtos_tipicos: string[];
  ordem_exibicao: number;
  ativo: boolean;
}

// ============================================
// DATABASE TYPE (para operações de banco)
// ============================================

export interface Database {
  public: {
    Tables: {
      tecnica_gravacao: {
        Row: TecnicaGravacaoRaw;
        Insert: Omit<TecnicaGravacaoRaw, 'id' | 'created_at' | 'updated_at' | 'slug'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          slug?: string;
        };
        Update: Partial<Omit<TecnicaGravacaoRaw, 'id' | 'created_at'>>;
      };
      tecnica_gravacao_variante: {
        Row: TecnicaGravacaoVarianteRaw;
        Insert: Omit<TecnicaGravacaoVarianteRaw, 'id' | 'created_at' | 'updated_at' | 'slug'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          slug?: string;
        };
        Update: Partial<Omit<TecnicaGravacaoVarianteRaw, 'id' | 'created_at'>>;
      };
      fornecedor_gravacao: {
        Row: FornecedorGravacaoRaw;
        Insert: Omit<FornecedorGravacaoRaw, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<FornecedorGravacaoRaw, 'id' | 'created_at'>>;
      };
      tecnica_faixa_area: {
        Row: TecnicaFaixaAreaRaw;
        Insert: Omit<TecnicaFaixaAreaRaw, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<TecnicaFaixaAreaRaw, 'id' | 'created_at'>>;
      };
      tecnica_faixa_pontos: {
        Row: TecnicaFaixaPontosRaw;
        Insert: Omit<TecnicaFaixaPontosRaw, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<TecnicaFaixaPontosRaw, 'id' | 'created_at'>>;
      };
      hot_stamping_fita_opcao: {
        Row: HotStampingFitaOpcaoRaw;
        Insert: Omit<HotStampingFitaOpcaoRaw, 'id'> & { id?: string };
        Update: Partial<Omit<HotStampingFitaOpcaoRaw, 'id'>>;
      };
      laser_acabamento_opcao: {
        Row: LaserAcabamentoOpcaoRaw;
        Insert: Omit<LaserAcabamentoOpcaoRaw, 'id'> & { id?: string };
        Update: Partial<Omit<LaserAcabamentoOpcaoRaw, 'id'>>;
      };
      tecnica_tipo_filme: {
        Row: TecnicaTipoFilmeRaw;
        Insert: Omit<TecnicaTipoFilmeRaw, 'id'> & { id?: string };
        Update: Partial<Omit<TecnicaTipoFilmeRaw, 'id'>>;
      };
    };
  };
}
