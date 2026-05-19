/**
 * ClientSelector — combobox para escolher cliente do CRM no módulo BI.
 */
import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Building2, Search, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCrmCompanies } from "@/hooks/useCrmCompanies";
import { getCompanyDisplayName } from "@/types/crm";
import { useSearchHistory } from "@/hooks/commonHistory";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ClientSelectorProps {
  value: string | null;
  onChange: (clientId: string | null) => void;
}

export function ClientSelector({ value, onChange }: ClientSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: companies, isLoading } = useCrmCompanies({ is_customer: true });
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory("company");

  const filtered = useMemo(() => {
    if (!companies) return [];
    if (!search.trim()) return companies.slice(0, 50);
    const needle = search.toLowerCase();
    return companies
      .filter((c) => {
        const display = getCompanyDisplayName(c).toLowerCase();
        return (
          display.includes(needle) ||
          c.cnpj?.toLowerCase().includes(needle) ||
          c.ramo_atividade?.toLowerCase().includes(needle)
        );
      })
      .slice(0, 50);
  }, [companies, search]);

  const handleSelect = (clientId: string, clientName: string) => {
    addToHistory({
      id: clientId,
      label: clientName,
      type: "company"
    });
    onChange(clientId);
    setOpen(false);
    setSearch("");
  };

  const selected = companies?.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-12 px-4 border-[1.5px] font-display"
        >
          <span className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            {selected ? (
              <span className="truncate">{getCompanyDisplayName(selected)}</span>
            ) : (
              <span className="text-muted-foreground">Selecionar cliente da carteira...</span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CNPJ ou ramo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8"
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="p-2 space-y-1">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              {!search && history.length > 0 && (
                <div className="p-2 border-b border-border/50">
                  <div className="flex items-center justify-between px-2 py-1 mb-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      Visitados Recentemente
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); clearHistory(); }}
                    >
                      Limpar
                    </Button>
                  </div>
                  {history.slice(0, 3).map((item) => (
                    <div key={item.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => handleSelect(item.id, item.label)}
                        className="w-full px-2 py-1.5 text-left flex items-center gap-2 hover:bg-accent rounded-md transition-colors"
                      >
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate flex-1">{item.label}</span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); removeFromHistory(item.id); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum cliente encontrado.
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c.id, getCompanyDisplayName(c))}
                    className={cn(
                      "w-full px-3 py-2 text-left flex items-start gap-3 hover:bg-accent transition-colors",
                      value === c.id && "bg-accent",
                    )}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 mt-1 text-primary shrink-0",
                        value === c.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{getCompanyDisplayName(c)}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.ramo_atividade ?? "Sem ramo"}{c.cidade ? ` · ${c.cidade}` : ""}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
