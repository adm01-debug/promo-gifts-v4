import * as React from 'react';
import { m as motion, AnimatePresence, Reorder } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Plus,
  X,
  GripVertical,
  Settings2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Lock,
  Unlock,
  LayoutGrid,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { logger } from '@/lib/logger';
// ============================================================================
// TYPES
// ============================================================================

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  colSpan?: 1 | 2 | 3 | 4;
  rowSpan?: 1 | 2;
  minWidth?: number;
  isLocked?: boolean;
  isCollapsed?: boolean;
  refreshInterval?: number;
  data?: unknown;
}

export interface WidgetConfig {
  type: string;
  title: string;
  icon?: React.ReactNode;
  description?: string;
  defaultColSpan?: 1 | 2 | 3 | 4;
  defaultRowSpan?: 1 | 2;
  component: React.ComponentType<{ widget: DashboardWidget; onUpdate?: (data: unknown) => void }>;
}

export interface DraggableDashboardProps {
  widgets: DashboardWidget[];
  onWidgetsChange: (widgets: DashboardWidget[]) => void;
  availableWidgets: WidgetConfig[];
  columns?: number;
  className?: string;
  isEditing?: boolean;
  onEditModeChange?: (isEditing: boolean) => void;
}

export interface DraggableWidgetProps {
  widget: DashboardWidget;
  config?: WidgetConfig;
  isEditing: boolean;
  onRemove: () => void;
  onToggleCollapse: () => void;
  onToggleLock: () => void;
  onResize: (colSpan: 1 | 2 | 3 | 4) => void;
  onRefresh?: () => void;
}

// ============================================================================
// HOOK: useDashboardWidgets
// ============================================================================

export interface UseDashboardWidgetsOptions {
  storageKey?: string;
  defaultWidgets?: DashboardWidget[];
}

export function useDashboardWidgets({
  storageKey,
  defaultWidgets = [],
}: UseDashboardWidgetsOptions = {}) {
  const [widgets, setWidgets] = React.useState<DashboardWidget[]>(() => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`dashboard_${storageKey}`);
        if (stored) return JSON.parse(stored);
      } catch (e) {
        logger.error('Failed to load dashboard widgets:', e);
      }
    }
    return defaultWidgets;
  });

  const [isEditing, setIsEditing] = React.useState(false);

  // Persist to storage
  React.useEffect(() => {
    if (storageKey) {
      try {
        localStorage.setItem(`dashboard_${storageKey}`, JSON.stringify(widgets));
      } catch (e) {
        logger.error('Failed to save dashboard widgets:', e);
      }
    }
  }, [widgets, storageKey]);

  const addWidget = React.useCallback((widget: Omit<DashboardWidget, 'id'>) => {
    const newWidget: DashboardWidget = {
      ...widget,
      id: crypto.randomUUID(),
    };
    setWidgets((prev) => [...prev, newWidget]);
    return newWidget;
  }, []);

  const removeWidget = React.useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const updateWidget = React.useCallback((id: string, updates: Partial<DashboardWidget>) => {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
  }, []);

  const reorderWidgets = React.useCallback((newOrder: DashboardWidget[]) => {
    setWidgets(newOrder);
  }, []);

  const resetWidgets = React.useCallback(() => {
    setWidgets(defaultWidgets);
  }, [defaultWidgets]);

  return {
    widgets,
    isEditing,
    setIsEditing,
    addWidget,
    removeWidget,
    updateWidget,
    reorderWidgets,
    resetWidgets,
    setWidgets,
  };
}

// ============================================================================
// DRAGGABLE WIDGET COMPONENT
// ============================================================================

export function DraggableWidget({
  widget,
  config,
  isEditing,
  onRemove,
  onToggleCollapse,
  onToggleLock,
  onResize,
  onRefresh,
}: DraggableWidgetProps) {
  const WidgetComponent = config?.component;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        'relative',
        widget.colSpan === 1 && 'col-span-1',
        widget.colSpan === 2 && 'col-span-2',
        widget.colSpan === 3 && 'col-span-3',
        widget.colSpan === 4 && 'col-span-4',
        widget.rowSpan === 2 && 'row-span-2',
      )}
    >
      <Card
        className={cn(
          'h-full transition-all',
          isEditing && 'ring-dashed ring-2 ring-primary/20',
          widget.isLocked && 'opacity-75',
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
          <div className="flex items-center gap-2">
            {isEditing && !widget.isLocked && (
              <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground active:cursor-grabbing" />
            )}
            <h3 className="font-display text-sm font-semibold">{widget.title}</h3>
          </div>

          <div className="flex items-center gap-1">
            {/* Refresh */}
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onRefresh}
                aria-label="Atualizar"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Collapse */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Maximizar"
              className="h-7 w-7"
              onClick={onToggleCollapse}
            >
              {widget.isCollapsed ? (
                <Maximize2 className="h-3.5 w-3.5" />
              ) : (
                <Minimize2 className="h-3.5 w-3.5" />
              )}
            </Button>

            {/* Edit Mode Actions */}
            {isEditing && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Bloquear"
                  className="h-7 w-7"
                  onClick={onToggleLock}
                >
                  {widget.isLocked ? (
                    <Lock className="h-3.5 w-3.5 text-warning" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5" />
                  )}
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Configurar widget">
                      <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Largura</p>
                      <div className="flex gap-1">
                        {([1, 2, 3, 4] as const).map((span) => (
                          <Button
                            key={span}
                            variant={widget.colSpan === span ? 'secondary' : 'ghost'}
                            size="sm"
                            className="flex-1"
                            onClick={() => onResize(span)}
                          >
                            {span}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {!widget.isLocked && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={onRemove}
                    aria-label="Fechar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
          </div>
        </CardHeader>

        <AnimatePresence>
          {!widget.isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <CardContent className="p-4 pt-2">
                {WidgetComponent ? (
                  <WidgetComponent widget={widget} />
                ) : (
                  <div className="flex h-32 items-center justify-center text-muted-foreground">
                    Widget não configurado
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// ============================================================================
// WIDGET PICKER
// ============================================================================

export interface WidgetPickerProps {
  availableWidgets: WidgetConfig[];
  onAddWidget: (config: WidgetConfig) => void;
  className?: string;
}

export function WidgetPicker({ availableWidgets, onAddWidget, className }: WidgetPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('gap-2', className)}>
          <Plus className="h-4 w-4" />
          Adicionar Widget
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold">Widgets Disponíveis</h4>
            <p className="text-xs text-muted-foreground">Clique para adicionar ao dashboard</p>
          </div>
          <div className="grid gap-2">
            {availableWidgets.map((config) => (
              <button
                key={config.type}
                onClick={() => {
                  onAddWidget(config);
                  setIsOpen(false);
                }}
                className="flex items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-primary/10">
                  {config.icon || <LayoutGrid className="h-4 w-4 text-primary" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{config.title}</p>
                  {config.description && (
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// DRAGGABLE DASHBOARD
// ============================================================================

export function DraggableDashboard({
  widgets,
  onWidgetsChange,
  availableWidgets,
  columns = 4,
  className,
  isEditing = false,
  onEditModeChange,
}: DraggableDashboardProps) {
  const handleAddWidget = (config: WidgetConfig) => {
    const newWidget: DashboardWidget = {
      id: crypto.randomUUID(),
      type: config.type,
      title: config.title,
      colSpan: config.defaultColSpan || 1,
      rowSpan: config.defaultRowSpan || 1,
    };
    onWidgetsChange([...widgets, newWidget]);
  };

  const handleRemoveWidget = (id: string) => {
    onWidgetsChange(widgets.filter((w) => w.id !== id));
  };

  const handleUpdateWidget = (id: string, updates: Partial<DashboardWidget>) => {
    onWidgetsChange(widgets.map((w) => (w.id === id ? { ...w, ...updates } : w)));
  };

  const getWidgetConfig = (type: string) => {
    return availableWidgets.find((c) => c.type === type);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isEditing && (
            <WidgetPicker availableWidgets={availableWidgets} onAddWidget={handleAddWidget} />
          )}
        </div>
        <Button
          variant={isEditing ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => onEditModeChange?.(!isEditing)}
        >
          <Settings2 className="mr-2 h-4 w-4" />
          {isEditing ? 'Concluir' : 'Editar Dashboard'}
        </Button>
      </div>

      {/* Grid */}
      <Reorder.Group
        axis="y"
        values={widgets}
        onReorder={onWidgetsChange}
        className={cn(
          'grid gap-4',
          columns === 2 && 'grid-cols-2',
          columns === 3 && 'grid-cols-3',
          columns === 4 && 'grid-cols-4',
        )}
      >
        <AnimatePresence>
          {widgets.map((widget) => (
            <Reorder.Item
              key={widget.id}
              value={widget}
              dragListener={isEditing && !widget.isLocked}
            >
              <DraggableWidget
                widget={widget}
                config={getWidgetConfig(widget.type)}
                isEditing={isEditing}
                onRemove={() => handleRemoveWidget(widget.id)}
                onToggleCollapse={() =>
                  handleUpdateWidget(widget.id, { isCollapsed: !widget.isCollapsed })
                }
                onToggleLock={() => handleUpdateWidget(widget.id, { isLocked: !widget.isLocked })}
                onResize={(colSpan) => handleUpdateWidget(widget.id, { colSpan })}
              />
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>

      {/* Empty State */}
      {widgets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <LayoutGrid className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="mb-2 font-display text-lg font-semibold">Dashboard vazio</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Adicione widgets para personalizar seu dashboard
          </p>
          {isEditing && (
            <WidgetPicker availableWidgets={availableWidgets} onAddWidget={handleAddWidget} />
          )}
        </div>
      )}
    </div>
  );
}
