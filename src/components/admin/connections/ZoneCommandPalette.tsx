/**
 * ZoneCommandPalette — Onda 14
 *
 * Quick nav por busca (Cmd/Ctrl+K) que indexa as 3 zonas + módulos internos
 * de /admin/conexoes. Ao escolher um item:
 *   1. Se a zona estiver oculta (Quick Nav visibility) → mostra novamente.
 *   2. Se a zona estiver colapsada → expande.
 *   3. Faz scroll suave até o anchor do módulo.
 *   4. Aplica highlight temporário (ring + glow) por 1.8s.
 *
 * Reaproveita o evento "connections:focus-zone" já existente para a zona,
 * e estende com "connections:focus-module" para módulos internos com
 * âncora própria (ex: tabs do "Conexões").
 */
import { useEffect, useMemo, useState } from 'react';
import { Activity, Settings2, Network, Layers } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import type { ZoneId } from './useZoneVisibility';

export interface ZoneCommandEntry {
  /** Zona alvo */
  zone: ZoneId;
  /** id do elemento DOM para scroll. Se omitido, usa o anchor da zona. */
  anchorId?: string;
  /** Texto principal exibido */
  label: string;
  /** Texto secundário (ex: nome da zona pai) */
  hint?: string;
  /** Palavras-chave extras para busca */
  keywords?: string[];
}

const ZONE_META: Record<ZoneId, { label: string; icon: typeof Activity; anchor: string }> = {
  health: { label: 'Saúde', icon: Activity, anchor: 'zone-health' },
  operation: { label: 'Operação', icon: Settings2, anchor: 'zone-operation' },
  connections: { label: 'Conexões', icon: Network, anchor: 'zone-connections' },
  'ai-router': { label: 'AI Router', icon: Layers, anchor: 'zone-ai-router' },
};

/** Catálogo padrão de módulos pesquisáveis dentro de cada zona. */
export const DEFAULT_MODULES: ZoneCommandEntry[] = [
  // Saúde
  {
    zone: 'health',
    label: 'Cartão de Integrações',
    hint: 'Saúde',
    keywords: ['health', 'card', 'status', 'uptime'],
  },
  // Operação
  {
    zone: 'operation',
    label: 'Intervalo de Auto-Test',
    hint: 'Operação',
    keywords: ['cron', 'interval', 'frequência'],
  },
  {
    zone: 'operation',
    label: 'Janela de Falha Contínua',
    hint: 'Operação',
    keywords: ['failure', 'window', 'alerta'],
  },
  {
    zone: 'operation',
    label: 'Status do Job de Auto-Test',
    hint: 'Operação',
    keywords: ['job', 'scheduler'],
  },
  // Conexões
  {
    zone: 'connections',
    label: 'Tabela de Conexões',
    hint: 'Conexões',
    keywords: ['overview', 'lista', 'table'],
  },
  {
    zone: 'connections',
    label: 'Bancos de Dados',
    hint: 'Conexões › Aba',
    keywords: ['supabase', 'postgres', 'db'],
  },
  { zone: 'connections', label: 'Bitrix24', hint: 'Conexões › Aba', keywords: ['crm', 'bitrix'] },
  {
    zone: 'connections',
    label: 'n8n',
    hint: 'Conexões › Aba',
    keywords: ['workflow', 'automação'],
  },
  {
    zone: 'connections',
    label: 'MCP (Claude)',
    hint: 'Conexões › Aba',
    keywords: ['claude', 'anthropic', 'mcp'],
  },
  {
    zone: 'connections',
    label: 'Webhooks',
    hint: 'Conexões › Aba',
    keywords: ['webhook', 'events', 'outbound'],
  },
];

interface ZoneCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Permite injetar/extender o catálogo (opcional). */
  modules?: ZoneCommandEntry[];
}

export function ZoneCommandPalette({
  open,
  onOpenChange,
  modules = DEFAULT_MODULES,
}: ZoneCommandPaletteProps) {
  const grouped = useMemo(() => {
    const m: Record<ZoneId, ZoneCommandEntry[]> = {
      health: [],
      operation: [],
      connections: [],
      'ai-router': [],
    };
    modules.forEach((mod) => m[mod.zone].push(mod));
    return m;
  }, [modules]);

  const handleSelect = (entry: ZoneCommandEntry | { zone: ZoneId; jumpToZone: true }) => {
    const zone = entry.zone;
    const anchorId =
      'jumpToZone' in entry || !entry.anchorId ? ZONE_META[zone].anchor : entry.anchorId;

    // Reaproveita o evento já tratado por AdminConexoesPage:
    // garante reveal + expand + scroll + highlight.
    window.dispatchEvent(
      new CustomEvent('connections:focus-zone', {
        detail: { zone, anchorId: ZONE_META[zone].anchor },
      }),
    );

    // Se o anchor é diferente da zona (módulo interno), faz scroll adicional após o expand.
    if (anchorId !== ZONE_META[zone].anchor) {
      requestAnimationFrame(() => {
        // Pequeno delay para deixar a zona expandir antes de descer ao módulo.
        window.setTimeout(() => {
          const el = document.getElementById(anchorId);
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      });
    }

    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar zona ou módulo… (ex: webhooks, cron, saúde)" />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>

        <CommandGroup heading="Ir para zona">
          {(Object.entries(ZONE_META) as [ZoneId, (typeof ZONE_META)[ZoneId]][]).map(
            ([zone, meta]) => {
              const Icon = meta.icon;
              return (
                <CommandItem
                  key={`zone-${zone}`}
                  value={`zona ${meta.label}`}
                  onSelect={() => handleSelect({ zone, jumpToZone: true })}
                >
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{meta.label}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">Zona</span>
                </CommandItem>
              );
            },
          )}
        </CommandGroup>

        {(Object.keys(grouped) as ZoneId[]).map((zone) => {
          const items = grouped[zone];
          if (items.length === 0) return null;
          const meta = ZONE_META[zone];
          return (
            <div key={`group-${zone}`}>
              <CommandSeparator />
              <CommandGroup heading={`Módulos · ${meta.label}`}>
                {items.map((mod) => (
                  <CommandItem
                    key={`${mod.zone}-${mod.label}`}
                    value={`${mod.label} ${mod.hint ?? ''} ${(mod.keywords ?? []).join(' ')}`}
                    onSelect={() => handleSelect(mod)}
                  >
                    <Layers className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{mod.label}</span>
                    {mod.hint && (
                      <span className="ml-auto text-[10px] text-muted-foreground">{mod.hint}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}

/**
 * Hook utilitário: registra o atalho global Cmd/Ctrl+K para abrir o palette.
 * Ignora quando o foco está em <input>, <textarea> ou contentEditable.
 */
export function useZoneCommandPaletteShortcut() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        const isEditing =
          tag === 'INPUT' || tag === 'TEXTAREA' || (target?.isContentEditable ?? false);
        if (isEditing) return;
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return { open, setOpen };
}
