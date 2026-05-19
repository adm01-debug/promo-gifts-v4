/**
 * MockupToolbar — Extracted undo/redo/save status bar from MockupGenerator
 */
import { Loader2, Undo2, Redo2, Cloud, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MockupToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isDraftSaving: boolean;
  lastSaved: Date | null;
  draftError: string | null;
}

export function MockupToolbar({
  canUndo, canRedo, onUndo, onRedo,
  isDraftSaving, lastSaved, draftError,
}: MockupToolbarProps) {
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button variant="ghost" size="icon" aria-label="Desfazer" className="h-8 w-8" disabled={!canUndo} onClick={onUndo}>
              <Undo2 className="h-4 w-4" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Desfazer (Ctrl+Z)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button variant="ghost" size="icon" aria-label="Refazer" className="h-8 w-8" disabled={!canRedo} onClick={onRedo}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Refazer (Ctrl+Shift+Z)</TooltipContent>
      </Tooltip>

      <div className="ml-1">
        {isDraftSaving ? (
          <Badge variant="secondary" className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Salvando...
          </Badge>
        ) : lastSaved ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Badge variant="outline" className="flex items-center gap-1.5 cursor-default">
                  <Cloud className="h-3 w-3 text-success" />
                  Salvo
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Último salvamento: {format(lastSaved, "HH:mm:ss", { locale: ptBR })}
            </TooltipContent>
          </Tooltip>
        ) : draftError ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Badge variant="destructive" className="flex items-center gap-1.5 cursor-default">
                  <CloudOff className="h-3 w-3" />
                  Erro ao salvar
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent>{draftError}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
