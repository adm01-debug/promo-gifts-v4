/**
 * AIRecommendationsPanel — Painel completo de recomendações de IA.
 *
 * Consome o hook `useAIRecommendations` (já existente) e apresenta:
 * - Form de perfil do cliente (colapsável)
 * - Lista de produtos selecionada (resumo)
 * - Botão para gerar recomendações
 * - Grid de cards com produto, score (%), motivo
 * - Bloco de insights gerais
 * - Estados: loading, error, empty
 *
 * Tokens: Outfit, var(--primary), border-[1.5px], rounded-xl, animate-fade-in.
 */
import { useState, useCallback, useMemo, type ChangeEvent } from 'react';
import { Sparkles, AlertCircle, RefreshCcw, TrendingUp, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FormSection } from '@/components/ui/FormSection';
import { cn } from '@/lib/utils';
import {
  useAIRecommendations,
  type ClientProfile,
  type ProductForRecommendation,
} from '@/hooks/intelligence';

// ============================================
// PROPS
// ============================================

export interface AIRecommendationsPanelProps {
  /** Lista de produtos disponíveis para serem rankeados pela IA. */
  products?: ProductForRecommendation[];
  /** Perfil inicial do cliente (opcional, pode ser editado pelo usuário). */
  initialClient?: Partial<ClientProfile>;
  /** Callback quando usuário clica num produto recomendado. */
  onProductClick?: (productId: string) => void;
  /** Esconde o formulário (modo "auto" — usa initialClient direto). */
  hideClientForm?: boolean;
  className?: string;
}

// ============================================
// SUB-COMPONENTES
// ============================================

interface RecommendationCardProps {
  product: ProductForRecommendation;
  score: number;
  reason: string;
  rank: number;
  onClick?: () => void;
}

function RecommendationCard({ product, score, reason, rank, onClick }: RecommendationCardProps) {
  const scorePct = Math.round(score * 100);
  const interactive = Boolean(onClick);

  return (
    <Card
      className={cn(
        'animate-fade-in overflow-hidden rounded-xl border-[1.5px] border-border transition-all duration-200',
        interactive && 'cursor-pointer hover:-translate-y-0.5 hover:border-primary hover:shadow-md',
      )}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      aria-label={interactive ? `Ver produto ${product.name}` : undefined}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] font-display text-xs font-bold',
                rank <= 3
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-muted text-muted-foreground',
              )}
              aria-label={`Posição ${rank}`}
            >
              {rank}
            </span>
            <CardTitle className="truncate font-display text-base">{product.name}</CardTitle>
          </div>
          <div
            className="flex items-center gap-1 rounded-full border-[1.5px] border-primary/30 bg-primary/5 px-2 py-0.5 font-display text-xs font-bold text-primary"
            aria-label={`Score ${scorePct} por cento`}
          >
            <TrendingUp className="h-3 w-3" />
            {scorePct}%
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-2">
        <p className="font-display text-xs text-muted-foreground">{product.category}</p>
        <p className="font-display text-sm leading-relaxed text-foreground/90">{reason}</p>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="rounded-xl border-[1.5px] border-border">
          <CardHeader className="p-4 pb-2">
            <Skeleton className="h-5 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function AIRecommendationsPanel({
  products,
  initialClient,
  onProductClick,
  hideClientForm = false,
  className,
}: AIRecommendationsPanelProps) {
  const [client, setClient] = useState<ClientProfile>({
    name: initialClient?.name ?? '',
    company: initialClient?.company ?? '',
    industry: initialClient?.industry ?? '',
    budget: initialClient?.budget ?? '',
    preferences: initialClient?.preferences ?? [],
    purchaseHistory: initialClient?.purchaseHistory ?? [],
  });

  const { data, recommendations, insights, isLoading, error, fetchRecommendations, reset } =
    useAIRecommendations();

  // Defensivo: products pode ser undefined em testes ou em fluxos onde
  // o pai ainda não carregou a lista. Normalizamos UMA vez para [] e
  // usamos safeProducts em todos os pontos seguintes (forEach, length,
  // fetchRecommendations).
  const safeProducts = useMemo(() => (Array.isArray(products) ? products : []), [products]);

  const productMap = useMemo(() => {
    const map = new Map<string, ProductForRecommendation>();
    safeProducts.forEach((p) => map.set(p.id, p));
    return map;
  }, [safeProducts]);

  const handleField = useCallback(
    (field: keyof ClientProfile) => (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setClient((prev) => ({
        ...prev,
        [field]:
          field === 'preferences'
            ? value
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean)
            : value,
      }));
    },
    [],
  );

  const handleGenerate = useCallback(() => {
    if (!client.name.trim() || safeProducts.length === 0) return;
    fetchRecommendations(client, safeProducts);
  }, [client, safeProducts, fetchRecommendations]);

  const canGenerate = client.name.trim() !== '' && safeProducts.length > 0 && !isLoading;

  return (
    <div className={cn('space-y-4 font-display', className)}>
      {/* Formulário do cliente */}
      {!hideClientForm && (
        <Card className="rounded-2xl border-[1.5px] border-border">
          <CardContent className="space-y-4 p-5">
            <FormSection
              title="Perfil do cliente"
              description="Quanto mais detalhes, melhores as recomendações."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Nome do cliente *"
                  value={client.name}
                  onChange={handleField('name')}
                  aria-label="Nome do cliente"
                  required
                />
                <Input
                  placeholder="Empresa"
                  value={client.company ?? ''}
                  onChange={handleField('company')}
                  aria-label="Empresa"
                />
                <Input
                  placeholder="Segmento (ex: tecnologia)"
                  value={client.industry ?? ''}
                  onChange={handleField('industry')}
                  aria-label="Segmento"
                />
                <Input
                  placeholder="Orçamento (ex: até R$ 5.000)"
                  value={client.budget ?? ''}
                  onChange={handleField('budget')}
                  aria-label="Orçamento"
                />
                <Input
                  className="sm:col-span-2"
                  placeholder="Preferências separadas por vírgula"
                  value={(client.preferences ?? []).join(', ')}
                  onChange={handleField('preferences')}
                  aria-label="Preferências"
                />
              </div>
            </FormSection>
          </CardContent>
        </Card>
      )}

      {/* Ação principal */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="h-4 w-4" aria-hidden="true" />
          <span>
            {safeProducts.length}{' '}
            {safeProducts.length === 1 ? 'produto disponível' : 'produtos disponíveis'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reset}
              aria-label="Limpar resultados"
            >
              <RefreshCcw className="h-4 w-4" />
              Limpar
            </Button>
          )}
          <Button
            type="button"
            variant="premium"
            onClick={handleGenerate}
            disabled={!canGenerate}
            aria-label="Gerar recomendações"
          >
            <Sparkles className="h-4 w-4" />
            {isLoading ? 'Analisando...' : 'Gerar Recomendações'}
          </Button>
        </div>
      </div>

      {/* Erro */}
      {error && !isLoading && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border-[1.5px] border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {isLoading && <LoadingSkeleton />}

      {/* Resultados */}
      {!isLoading && recommendations.length > 0 && (
        <div className="animate-fade-in space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {recommendations.map((rec, idx) => {
              const product = productMap.get(rec.productId);
              if (!product) return null;
              return (
                <RecommendationCard
                  key={rec.productId}
                  product={product}
                  score={rec.score}
                  reason={rec.reason}
                  rank={idx + 1}
                  onClick={onProductClick ? () => onProductClick(rec.productId) : undefined}
                />
              );
            })}
          </div>

          {insights && (
            <Card className="rounded-2xl border-[1.5px] border-primary/30 bg-primary/5">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="flex items-center gap-2 font-display text-base">
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                  Insights da IA
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-2">
                <p className="text-sm leading-relaxed text-foreground/90">{insights}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && recommendations.length === 0 && data === null && (
        <div className="flex flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-border py-10 text-center text-muted-foreground">
          <Sparkles className="mb-3 h-10 w-10 opacity-40" aria-hidden="true" />
          <p className="text-sm">Preencha o perfil e clique em "Gerar Recomendações"</p>
        </div>
      )}
    </div>
  );
}
