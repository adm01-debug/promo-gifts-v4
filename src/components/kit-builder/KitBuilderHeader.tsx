/**
 * Kit Builder Header — 2-tier premium layout
 * Tier 1: Identity (name + status badges) — stripe + colored icon refletem identidade
 * Tier 2: Primary actions (Save, New, Library)
 */
import {
  Save,
  Cloud,
  Loader2,
  RotateCcw,
  Undo2,
  Redo2,
  Check,
  Library,
  Sparkles,
} from 'lucide-react';
import * as Lucide from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BackButton } from '@/components/common/BackButton';
import { KitAIPromptDialog } from '@/components/kit-builder/KitAIPromptDialog';
import { KitIdentityPicker } from '@/components/kit-builder/KitIdentityPicker';
import { useRBAC } from '@/hooks/auth';
import { useTemplateSnapshot } from '@/hooks/kit-builder';
import type { KitIdentity, KitState } from '@/lib/kit-builder';
import { cn } from '@/lib/utils';

interface KitBuilderHeaderProps {
  kitName: string;
  onKitNameChange: (name: string) => void;
  isValid: boolean;
  isSaving: boolean;
  isAutoSaving: boolean;
  lastSavedAt: Date | null;
  hasContent: boolean;
  isExistingKit: boolean;
  canUndo: boolean;
  canRedo: boolean;
  identity?: KitIdentity;
  onIdentityChange: (next: KitIdentity) => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onAIApply: (s: { kit_type: 'montado' | 'original' | 'simples'; box_keywords: string[] }) => void;
  /** Full kit state — used by admin "Save as system template" snapshot. */
  kitState?: KitState;
  /** When set, header indicates we are editing a system template (admin mode). */
  templateId?: string;
  currentKitId?: string;
}

export function KitBuilderHeader({
  kitName,
  onKitNameChange,
  isValid,
  isSaving,
  isAutoSaving,
  lastSavedAt,
  hasContent,
  isExistingKit,
  canUndo,
  canRedo,
  identity,
  onIdentityChange,
  onSave,
  onUndo,
  onRedo,
  onReset,
  onAIApply,
  kitState,
  templateId,
  currentKitId,
}: KitBuilderHeaderProps) {
  const navigate = useNavigate();
  const { isAdmin } = useRBAC();
  const { saveAsTemplate, isSavingTemplate } = useTemplateSnapshot();
  const SaveIcon = isSaving ? Loader2 : lastSavedAt && !isAutoSaving ? Check : Save;

  const identityColor = identity?.color || '#3B82F6';
  const identityIconName = identity?.icon || 'Package';
  const IdentityIcon =
    (
      Lucide as unknown as Record<
        string,
        React.ComponentType<{ className?: string; strokeWidth?: number }>
      >
    )[identityIconName] || Lucide.Package;

  return (
    <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md">
      {/* Identity color stripe */}
      <div
        className="h-1 w-full transition-colors"
        style={{ background: identityColor }}
        aria-hidden
      />
      <div className="container py-3">
        <BackButton fallbackPath="/meus-kits" className="mb-2" />

        {/* TIER 1 — Identity */}
        <div className="mb-3 flex items-center gap-3">
          <div
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors"
            style={{
              background: `${identityColor}1A`,
              borderColor: `${identityColor}40`,
              color: identityColor,
            }}
          >
            <IdentityIcon className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <Input
              value={kitName}
              onChange={(e) => onKitNameChange(e.target.value)}
              placeholder="Kit sem nome"
              aria-label="Nome do kit"
              className={cn(
                'h-auto border-0 bg-transparent px-0 py-0 font-display text-2xl font-bold tracking-tight shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
                !kitName && 'italic text-muted-foreground',
              )}
            />
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>Kit Maker</span>
              {templateId && (
                <Badge className="h-5 gap-1 border-primary/30 bg-primary/15 text-[10px] text-primary">
                  <Sparkles className="h-2.5 w-2.5" /> Editando template do sistema
                </Badge>
              )}
              {identity?.tag && (
                <Badge variant="secondary" className="h-5 text-[10px]">
                  {identity.tag}
                </Badge>
              )}
              {lastSavedAt && !isAutoSaving && (
                <Badge
                  variant="outline"
                  className="h-5 gap-1 border-success/40 text-[10px] text-success"
                >
                  <Cloud className="h-2.5 w-2.5" />
                  Salvo{' '}
                  {lastSavedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </Badge>
              )}
              {isAutoSaving && (
                <Badge variant="outline" className="h-5 gap-1 text-[10px]">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> Salvando…
                </Badge>
              )}
              {isValid && hasContent && !isAutoSaving && (
                <Badge className="h-5 gap-1 border-success/30 bg-success/15 text-[10px] text-success hover:bg-success/20">
                  ✓ Kit válido
                </Badge>
              )}
            </div>
          </div>

          {/* TIER 2 — Primary actions */}
          <div className="flex shrink-0 items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Desfazer"
                    disabled={!canUndo}
                    onClick={onUndo}
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Desfazer (Ctrl+Z)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Refazer"
                    disabled={!canRedo}
                    onClick={onRedo}
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refazer (Ctrl+Y)</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <KitIdentityPicker identity={identity} onChange={onIdentityChange} />

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/meus-kits')}
                    className="gap-2"
                    aria-label="Abrir biblioteca de kits"
                  >
                    <Library className="h-4 w-4" />
                    <span className="hidden md:inline">Biblioteca</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Abrir biblioteca de kits</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {isAdmin && kitState && hasContent && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => saveAsTemplate({ kitState, templateId })}
                      disabled={isSavingTemplate}
                      className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
                      aria-label="Salvar como template do sistema"
                    >
                      {isSavingTemplate ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      <span className="hidden md:inline">
                        {templateId ? 'Atualizar template' : 'Salvar como template'}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {templateId
                      ? 'Atualizar template do sistema'
                      : 'Salvar este kit como template do sistema (admin)'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <Button
              variant={isValid && hasContent ? 'default' : 'outline'}
              onClick={onSave}
              disabled={isSaving || !hasContent}
              className="font-medium"
            >
              <SaveIcon className={cn('mr-2 h-4 w-4', isSaving && 'animate-spin')} />
              {isExistingKit ? 'Atualizar' : 'Salvar'}
            </Button>

            <Button
              variant="outline"
              onClick={onReset}
              className="font-medium text-destructive hover:text-destructive"
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Novo kit
            </Button>

            <div className="hidden lg:block">
              <KitAIPromptDialog onApply={onAIApply} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
