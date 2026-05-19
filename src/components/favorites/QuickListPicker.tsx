import { useState } from "react";
import { Heart, Plus, Check } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { FavoriteList } from "@/hooks/favoritesLists";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: FavoriteList[];
  /** id de listas em que o produto já está. */
  existingListIds: Set<string>;
  onPick: (listId: string) => void;
  onCreateAndPick: (name: string) => Promise<string>;
  /** Trigger element (ex.: ícone de coração). */
  children: React.ReactNode;
  /** Nome do produto sendo adicionado (mostrado no header). */
  productName?: string;
  /** Variante atual selecionada (cor) — exibida com swatch. */
  variantInfo?: { color_name?: string | null; color_hex?: string | null } | null;
}

/**
 * Popover compacto para selecionar lista ao favoritar a partir do catálogo.
 * Mostra lista atual, permite criar nova lista inline.
 */
export function QuickListPicker({
  open, onOpenChange, lists, existingListIds, onPick, onCreateAndPick, children,
  productName, variantInfo,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    const id = await onCreateAndPick(name);
    onPick(id);
    setNewName("");
    setCreating(false);
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-64 p-2"
        align="end"
        side="bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Salvar em qual lista?
        </div>
        {(productName || variantInfo?.color_name) && (
          <div className="px-2 pb-1.5 -mt-1 flex items-center gap-1.5 text-[11px] text-foreground/80 border-b mb-1">
            {variantInfo?.color_hex && (
              <span
                className="inline-block w-3 h-3 rounded-full border border-border shrink-0"
                style={{ backgroundColor: variantInfo.color_hex }}
                aria-hidden
              />
            )}
            <span className="truncate">
              {productName ? <strong className="font-medium">{productName}</strong> : null}
              {productName && variantInfo?.color_name ? " — " : ""}
              {variantInfo?.color_name ?? ""}
            </span>
          </div>
        )}
        <ScrollArea className="max-h-60">
          <div className="space-y-0.5">
            {lists.map((l) => {
              const exists = existingListIds.has(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onPick(l.id); onOpenChange(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors",
                    "hover:bg-muted",
                    exists && "bg-success/10 text-success-foreground"
                  )}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: l.color }}
                  />
                  <Heart className="h-3.5 w-3.5 shrink-0 opacity-60" fill={exists ? "currentColor" : "none"} />
                  <span className="flex-1 truncate">{l.name}</span>
                  {l.is_default && (
                    <span className="text-[9px] uppercase text-muted-foreground">padrão</span>
                  )}
                  {exists && <Check className="h-3.5 w-3.5 text-success" />}
                </button>
              );
            })}
          </div>
        </ScrollArea>
        <div className="border-t mt-1 pt-1">
          {creating ? (
            <div className="flex gap-1 p-1">
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") { setCreating(false); setNewName(""); }
                }}
                placeholder="Nome da nova lista"
                className="h-7 text-xs"
              />
              <Button size="sm" className="h-7 px-2 text-xs" onClick={handleCreate}>OK</Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCreating(true); }}
              className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova lista…
            </button>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground px-2 pt-1.5 border-t mt-1">
          Dica: <kbd className="px-1 rounded bg-muted">Shift</kbd>+clique salva direto na lista padrão.
        </div>
      </PopoverContent>
    </Popover>
  );
}
