/**
 * useAiRouter — hooks para gerenciar AI Router via UI /admin/conexoes
 *
 * ⚠️ SCHEMA-ALIGNED (2026-05-10): As interfaces aqui refletem fielmente o
 * schema real das 3 tabelas no banco doufsxqlfjyuvxuezpln (ground truth).
 * Quando regenerar `database.types.ts`, remover o cast `sb: any` abaixo —
 * já está conforme o schema, deve "just work".
 *
 * Tabelas cobertas:
 *   - ai_providers          (provedores: OpenAI, Anthropic, Google, DeepSeek, Lovable…)
 *   - ai_models             (modelos por provider, com custos e capabilities)
 *   - ai_function_routing   (mapa function_name → primary_model + fallbacks)
 *
 * RLS dev-only: todas as mutations exigem usuário com role='dev' (is_dev() RPC).
 * O acesso à página /admin/conexoes já é protegido por DevRoute.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { untypedFrom } from '@/lib/supabase-untyped';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

// As tabelas de AI (ai_providers, ai_models, ai_function_routing) existem no
// schema gerado, mas as interfaces hand-written abaixo são o ground truth do
// app. Usamos untypedFrom para o builder permissivo e evitar fricção de
// excess-property entre as interfaces e os tipos Insert/Update gerados.
const sb = { from: untypedFrom };

// ============================================================
// Types — SCHEMA REAL (ground truth)
// ============================================================

/**
 * api_format usa underscore no banco (não kebab-case).
 * Valores válidos vêm da migration original (CHECK constraint no banco).
 */
export type AiApiFormat = 'openai_compatible' | 'anthropic_native' | 'google_native' | 'custom';

export interface AiProvider {
  id: string;
  slug: string;
  display_name: string;
  api_base_url: string;
  api_format: AiApiFormat;
  /** Header onde a API key é enviada. Default: "Authorization" */
  auth_header: string;
  /** Template do valor do header. Ex: "Bearer {key}" para OpenAI, "{key}" para Anthropic */
  auth_format: string;
  /** Nome do secret no SECRETS_MANAGER (ex: "OPENAI_API_KEY"). NOT NULL */
  secret_name: string;
  is_active: boolean;
  /** Menor número = mais prioritário no tie-breaker entre providers */
  priority: number;
  timeout_ms: number;
  max_retries: number;
  /**
   * Metadata flexível (jsonb). Usada hoje para:
   * - notes (descrição livre)
   * - supports_image_out, supports_extended_thinking
   * - required_headers (ex: anthropic-version)
   * - organization_header (OpenAI Organization)
   */
  metadata: Record<string, unknown>;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  /** Mensagem do último teste (sucesso ou erro). Renomeado de last_test_error. */
  last_test_message: string | null;
  /** Latência (ms) do último teste bem-sucedido. */
  last_latency_ms: number | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface AiModel {
  id: string;
  provider_id: string;
  /** ID do modelo dentro do provider (ex: "gpt-5-mini", "google/gemini-2.5-flash-image-preview") */
  model_id: string;
  display_name: string;
  /**
   * Capabilities como objeto booleano (jsonb).
   * Chaves canônicas: chat, streaming, tools, json_mode, vision_in, image_out, audio_in, audio_out
   */
  capabilities: Record<string, boolean>;
  cost_input_per_1m: number;
  cost_output_per_1m: number;
  cost_per_image: number;
  max_input_tokens: number | null;
  max_output_tokens: number | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  /** Hidratado via select com !inner — opcional para UIs mais simples */
  provider?: Pick<AiProvider, 'id' | 'slug' | 'display_name' | 'api_format' | 'is_active'>;
}

export interface AiFunctionRouting {
  id: string;
  function_name: string;
  primary_model_id: string;
  /** uuid[] no banco. Ordem == prioridade dos fallbacks. */
  fallback_model_ids: string[];
  /**
   * Capabilities REQUIRED como objeto (não array!).
   * Ex: {chat: true, tools: true} significa que ambas precisam ser suportadas.
   */
  required_capabilities: Record<string, boolean>;
  request_overrides: Record<string, unknown>;
  is_active: boolean;
  notes: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  /** Hidratado via select — primary model com slug e provider para mostrar na UI */
  primary_model?: Pick<AiModel, 'id' | 'model_id' | 'display_name' | 'provider_id'> & {
    provider?: Pick<AiProvider, 'slug' | 'display_name'>;
  };
}

// ============================================================
// Input types (omitem campos auto-gerados)
// ============================================================

export type ProviderInput = Omit<
  AiProvider,
  | 'id'
  | 'created_at'
  | 'created_by'
  | 'updated_at'
  | 'updated_by'
  | 'last_test_at'
  | 'last_test_ok'
  | 'last_test_message'
  | 'last_latency_ms'
>;

export type ModelInput = Omit<AiModel, 'id' | 'created_at' | 'updated_at' | 'provider'>;

export type RoutingInput = Omit<
  AiFunctionRouting,
  'id' | 'created_at' | 'updated_at' | 'primary_model'
>;

// ============================================================
// Query Keys
// ============================================================

const QK = {
  providers: ['ai-router', 'providers'] as const,
  models: ['ai-router', 'models'] as const,
  routing: ['ai-router', 'routing'] as const,
} as const;

// ============================================================
// Providers
// ============================================================

export function useAiProviders() {
  return useQuery({
    queryKey: QK.providers,
    queryFn: async (): Promise<AiProvider[]> => {
      const { data, error } = await sb
        .from('ai_providers')
        .select('*')
        .order('priority', { ascending: true })
        .order('slug', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AiProvider[];
    },
    staleTime: 10 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });
}

export function useAiProviderMutations() {
  const qc = useQueryClient();

  const createProvider = useMutation({
    mutationFn: async (input: ProviderInput): Promise<AiProvider> => {
      const { data, error } = await sb.from('ai_providers').insert(input).select().single();
      if (error) throw error;
      return data as AiProvider;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.providers });
      toast.success('Provider criado.');
    },
    onError: (e: Error) => toast.error('Erro ao criar provider', { description: sanitizeError(e) }),
  });

  const updateProvider = useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: Partial<AiProvider> & { id: string }): Promise<AiProvider> => {
      const { data, error } = await sb
        .from('ai_providers')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as AiProvider;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.providers });
      toast.success('Provider atualizado.');
    },
    onError: (e: Error) =>
      toast.error('Erro ao atualizar provider', { description: sanitizeError(e) }),
  });

  const deleteProvider = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await sb.from('ai_providers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.providers });
      qc.invalidateQueries({ queryKey: QK.models });
      qc.invalidateQueries({ queryKey: QK.routing });
      toast.success('Provider removido.');
    },
    onError: (e: Error) =>
      toast.error('Erro ao remover provider', { description: sanitizeError(e) }),
  });

  return { createProvider, updateProvider, deleteProvider };
}

// ============================================================
// Models
// ============================================================

export function useAiModels() {
  return useQuery({
    queryKey: QK.models,
    queryFn: async (): Promise<AiModel[]> => {
      const { data, error } = await sb
        .from('ai_models')
        .select('*, provider:ai_providers!inner(id,slug,display_name,api_format,is_active)')
        .order('model_id', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AiModel[];
    },
    staleTime: 10 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });
}

export function useAiModelMutations() {
  const qc = useQueryClient();

  const createModel = useMutation({
    mutationFn: async (input: ModelInput): Promise<AiModel> => {
      const { data, error } = await sb.from('ai_models').insert(input).select().single();
      if (error) throw error;
      return data as AiModel;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.models });
      toast.success('Modelo criado.');
    },
    onError: (e: Error) => toast.error('Erro ao criar modelo', { description: sanitizeError(e) }),
  });

  const updateModel = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<AiModel> & { id: string }): Promise<AiModel> => {
      const cleanPatch: Record<string, unknown> = { ...patch };
      delete cleanPatch.provider;
      const { data, error } = await sb
        .from('ai_models')
        .update(cleanPatch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as AiModel;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.models });
      qc.invalidateQueries({ queryKey: QK.routing });
      toast.success('Modelo atualizado.');
    },
    onError: (e: Error) =>
      toast.error('Erro ao atualizar modelo', { description: sanitizeError(e) }),
  });

  const deleteModel = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await sb.from('ai_models').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.models });
      qc.invalidateQueries({ queryKey: QK.routing });
      toast.success('Modelo removido.');
    },
    onError: (e: Error) => toast.error('Erro ao remover modelo', { description: sanitizeError(e) }),
  });

  return { createModel, updateModel, deleteModel };
}

// ============================================================
// Routing
// ============================================================

export function useAiRouting() {
  return useQuery({
    queryKey: QK.routing,
    queryFn: async (): Promise<AiFunctionRouting[]> => {
      const { data, error } = await sb
        .from('ai_function_routing')
        .select(
          `*,
          primary_model:ai_models!primary_model_id(
            id, model_id, display_name, provider_id,
            provider:ai_providers!inner(slug, display_name)
          )`,
        )
        .order('function_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AiFunctionRouting[];
    },
    staleTime: 10 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });
}

export function useAiRoutingMutations() {
  const qc = useQueryClient();

  const createRouting = useMutation({
    mutationFn: async (input: RoutingInput): Promise<AiFunctionRouting> => {
      const { data, error } = await sb.from('ai_function_routing').insert(input).select().single();
      if (error) throw error;
      return data as AiFunctionRouting;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.routing });
      toast.success('Roteamento criado.');
    },
    onError: (e: Error) =>
      toast.error('Erro ao criar roteamento', { description: sanitizeError(e) }),
  });

  const updateRouting = useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: Partial<AiFunctionRouting> & { id: string }): Promise<AiFunctionRouting> => {
      const cleanPatch: Record<string, unknown> = { ...patch };
      delete cleanPatch.primary_model;
      const { data, error } = await sb
        .from('ai_function_routing')
        .update(cleanPatch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as AiFunctionRouting;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.routing });
      toast.success('Roteamento atualizado.');
    },
    onError: (e: Error) =>
      toast.error('Erro ao atualizar roteamento', { description: sanitizeError(e) }),
  });

  const deleteRouting = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await sb.from('ai_function_routing').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.routing });
      toast.success('Roteamento removido.');
    },
    onError: (e: Error) =>
      toast.error('Erro ao remover roteamento', { description: sanitizeError(e) }),
  });

  return { createRouting, updateRouting, deleteRouting };
}

// ============================================================
// Helpers
// ============================================================

/**
 * Converte capabilities entre representações:
 * - UI usa Set<string> ou string[] (mais natural para tag-list)
 * - Banco usa Record<string, boolean>
 */
export function capabilitiesToArray(caps: Record<string, boolean>): string[] {
  return Object.entries(caps)
    .filter(([, v]) => v)
    .map(([k]) => k);
}

export function capabilitiesFromArray(keys: string[]): Record<string, boolean> {
  return Object.fromEntries(keys.map((k) => [k, true]));
}
