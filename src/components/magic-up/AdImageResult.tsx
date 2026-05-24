/**
 * AdImageResult — Exibe o resultado da imagem publicitária gerada
 * Com suporte a galeria de histórico, favoritos, variações e export
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download, Share2, RotateCcw, ImageIcon, Loader2,
  Heart, Copy, FileImage, FileText, Star,
  Clock, Trash2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type MagicUpCopyPack,
  type MagicUpCurationStatus as MagicUpCurationStatusValue,
  type MagicUpQualityDiagnosis,
  type MagicUpQualityScore,
  buildQualityDiagnosis,
} from "@/pages/magic-up/magicUpStrategy";
import { MagicUpQualityScore as MagicUpQualityScoreCard } from "./MagicUpQualityScore";
import { MagicUpQualityChecklist } from "./MagicUpQualityChecklist";
import { MagicUpCurationStatus } from "./MagicUpCurationStatus";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface GenerationHistoryItem {
  id: string;
  generated_image_url: string;
  product_name: string;
  scene_title?: string | null;
  scene_category?: string | null;
  is_favorite: boolean;
  created_at: string;
  client_name?: string | null;
  quality_score?: number | null;
  status?: string | null;
  channel?: string | null;
  aspect_ratio?: string | null;
  metadata?: { qualityDiagnosis?: MagicUpQualityDiagnosis } | null;
  copy_pack?: MagicUpCopyPack | null;
}

interface AdImageResultProps {
  imageUrl: string | null;
  isLoading: boolean;
  productName?: string;
  sceneName?: string;
  onDownload: (format?: "png" | "jpg") => void;
  onShare: () => void;
  onRegenerate: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  history?: GenerationHistoryItem[];
  onSelectHistory?: (item: GenerationHistoryItem) => void;
  onDeleteHistory?: (id: string) => void;
  onToggleHistoryFavorite?: (id: string, current: boolean) => void;
  qualityScore?: MagicUpQualityScore;
  qualityDiagnosis?: MagicUpQualityDiagnosis;
  curationStatus?: MagicUpCurationStatusValue;
  onSetCurationStatus?: (status: MagicUpCurationStatusValue) => void;
  onRunQualityScore?: () => void;
  copyPack?: MagicUpCopyPack;
  aspectRatio?: string;
}

export function AdImageResult({
  imageUrl,
  isLoading,
  productName,
  sceneName,
  onDownload,
  onShare,
  onRegenerate,
  onToggleFavorite,
  isFavorite,
  history = [],
  onSelectHistory,
  onDeleteHistory,
  onToggleHistoryFavorite,
  qualityScore,
  qualityDiagnosis,
  curationStatus = "draft",
  onSetCurationStatus,
  onRunQualityScore,
  copyPack,
  aspectRatio,
}: AdImageResultProps) {
  const [showHistory, setShowHistory] = useState(false);
  const diagnosis = qualityDiagnosis || (qualityScore ? buildQualityDiagnosis(qualityScore) : null);

  if (isLoading) {
    return (
      <Card className="border-primary/20 overflow-hidden">
        <CardContent className="p-0">
          <div className="aspect-square flex flex-col items-center justify-center bg-gradient-glow">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-primary/60" />
              </div>
            </div>
            <p className="mt-6 text-sm font-medium text-foreground">Criando imagem publicitária...</p>
            <p className="text-xs text-muted-foreground mt-1">Isso pode levar 30-60 segundos (modelo Pro)</p>
            <div className="mt-4 flex flex-col gap-1 text-[11px] text-muted-foreground">
              <span>✨ Analisando produto e logo</span>
              <span>🎨 Compondo cenário publicitário</span>
              <span>📸 Renderizando foto comercial HD</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!imageUrl && !showHistory) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="text-center text-muted-foreground max-w-xs">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <ImageIcon className="h-8 w-8 opacity-50" />
            </div>
            <p className="font-medium text-foreground mb-1">Sua imagem aparecerá aqui</p>
            <p className="text-sm">Configure o produto, logo e cenário, depois clique em "Gerar Imagem"</p>
          </div>
          {history.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-1.5"
              onClick={() => setShowHistory(true)}
            >
              <Clock className="h-3.5 w-3.5" />
              Ver histórico ({history.length})
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // History gallery view
  if (showHistory && !imageUrl) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Histórico
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
              Fechar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 gap-2 max-h-[500px] overflow-y-auto">
            {history.map((item) => (
              <div
                role="button"
                tabIndex={0}
                key={item.id}
                className="relative group rounded-lg overflow-hidden border cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onSelectHistory?.(item)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectHistory?.(item); } }}
                aria-label={`Selecionar histórico ${item.product_name}`}
              >
                <img
                  src={item.generated_image_url}
                  alt={item.product_name}
                  className="w-full aspect-square object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                  <p className="text-[10px] text-primary-foreground font-medium truncate">{item.product_name}</p>
                  {item.scene_title && (
                    <p className="text-[9px] text-primary-foreground/70 truncate">{item.scene_title}</p>
                  )}
                  <div className="flex gap-1 mt-1">
                    {typeof item.quality_score === "number" && <Badge variant="secondary" className="h-5 text-[9px]">{item.quality_score}</Badge>}
                    {item.status && <Badge variant="outline" className="h-5 text-[9px]">{item.status}</Badge>}
                    {onToggleHistoryFavorite && (
                      <button
                        type="button"
                        aria-label={item.is_favorite ? "Remover favorito do histórico" : "Favoritar histórico"}
                        onClick={(e) => { e.stopPropagation(); onToggleHistoryFavorite(item.id, item.is_favorite); }}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="p-1 rounded bg-white/20 hover:bg-white/30"
                      >
                        <Heart className={cn("h-3 w-3", item.is_favorite ? "fill-red-400 text-destructive" : "text-primary-foreground")} />
                      </button>
                    )}
                    {onDeleteHistory && (
                      <button type="button" aria-label="Excluir histórico"
                        onClick={(e) => { e.stopPropagation(); onDeleteHistory(item.id); }}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="p-1 rounded bg-white/20 hover:bg-destructive/50"
                      >
                        <Trash2 className="h-3 w-3 text-primary-foreground" />
                      </button>
                    )}
                  </div>
                </div>
                {item.is_favorite && (
                  <div className="absolute top-1 right-1">
                    <Heart className="h-3.5 w-3.5 fill-red-400 text-destructive drop-shadow" />
                  </div>
                )}
              </div>
            ))}
          </div>
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma imagem gerada ainda</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            📸 Resultado
          </CardTitle>
          <div className="flex items-center gap-1">
            {productName && <Badge variant="secondary" className="text-[10px]">{productName}</Badge>}
            {sceneName && <Badge variant="outline" className="text-[10px]">{sceneName}</Badge>}
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="icon" aria-label="Abrir histórico de imagens"
                className="h-7 w-7"
                onClick={() => setShowHistory(!showHistory)}
                title="Ver histórico"
              >
                <Clock className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative group">
          <img
            src={imageUrl!}
            alt={`Imagem publicitária - ${productName}`}
            className="w-full aspect-square object-cover" loading="lazy" />
          {/* Favorite button */}
          {onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
              aria-label={isFavorite ? "Remover imagem dos favoritos" : "Favoritar imagem"}>
              <Heart className={cn("h-5 w-5", isFavorite ? "fill-red-400 text-destructive" : "text-primary-foreground")} />
            </button>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-end justify-center opacity-0 group-hover:opacity-100">
            <div className="flex gap-2 mb-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="gap-1.5 shadow-lg">
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => onDownload("png")}>
                    <FileImage className="h-4 w-4 mr-2" /> PNG (Alta qualidade)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDownload("jpg")}>
                    <FileText className="h-4 w-4 mr-2" /> JPG (WhatsApp)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="secondary" onClick={onShare} className="gap-1.5 shadow-lg">
                <Share2 className="h-4 w-4" />
                WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={onRegenerate} className="gap-1.5 shadow-lg bg-background">
                <RotateCcw className="h-4 w-4" />
                Variação
              </Button>
            </div>
          </div>
        </div>
        {/* Action buttons always visible on mobile */}
        <div className="flex gap-2 p-3 sm:hidden">
          <Button size="sm" onClick={() => onDownload("png")} className="flex-1 gap-1.5">
            <Download className="h-4 w-4" /> Download
          </Button>
          <Button size="sm" variant="secondary" onClick={onShare} className="flex-1 gap-1.5">
            <Share2 className="h-4 w-4" /> WhatsApp
          </Button>
        </div>
        {(diagnosis || copyPack) && (
          <div className="border-t p-3 space-y-3">
            {diagnosis && (
              <>
                <MagicUpQualityScoreCard diagnosis={diagnosis} aspectRatio={aspectRatio} />
                <MagicUpQualityChecklist diagnosis={diagnosis} />
                <MagicUpCurationStatus value={curationStatus} disabled={!onSetCurationStatus} onChange={(status) => onSetCurationStatus?.(status)} />
                {onRunQualityScore && <Button type="button" size="sm" variant="outline" className="w-full" onClick={onRunQualityScore}>Reanalisar Magic Score</Button>}
              </>
            )}
            {copyPack && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Copy comercial</p>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => navigator.clipboard?.writeText(copyPack.whatsapp)}>
                    <Copy className="h-3.5 w-3.5" /> Copiar WhatsApp
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{copyPack.whatsapp}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
