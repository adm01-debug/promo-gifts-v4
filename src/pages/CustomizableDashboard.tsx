import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DndContext,
  type DragEndEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, LayoutDashboard, FileText, Target, RotateCcw, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { PageSEO } from '@/components/seo/PageSEO';
import { UpcomingDatesWidget } from '@/components/dashboard/UpcomingDatesWidget';
import { QuickActionsPanel } from '@/components/dashboard/QuickActionsPanel';
import { RecentKitsWidget } from '@/components/dashboard/RecentKitsWidget';
import { MyRecentQuotesWidget } from '@/components/dashboard/MyRecentQuotesWidget';
import { MyDiscountRequestsWidget } from '@/components/dashboard/MyDiscountRequestsWidget';
import { MyClientsWidget } from '@/components/dashboard/MyClientsWidget';
import { ScopeBadge } from '@/components/common/ScopeBadge';
import { ScheduledReportsManager } from '@/components/reports/ScheduledReportsManager';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentOrgId } from '@/hooks/common';
import { useSalesScope } from '@/lib/auth/visibility-scope';
import { toast } from 'sonner';

interface WidgetConfig {
  id: string;
  title: string;
  visible: boolean;
  order: number;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'quick-actions', title: 'Ações Rápidas', visible: true, order: 0 },
  { id: 'upcoming-dates', title: 'Datas Comemorativas', visible: true, order: 1 },
  { id: 'recent-kits', title: 'Kits Recentes', visible: true, order: 2 },
  { id: 'my-quotes', title: 'Minhas Propostas Recentes', visible: true, order: 3 },
  { id: 'my-discounts', title: 'Minhas Solicitações de Desconto', visible: true, order: 4 },
  { id: 'my-clients', title: 'Meus Clientes', visible: true, order: 5 },
  { id: 'vendas', title: 'Total de Orçamentos', visible: true, order: 6 },
  { id: 'orcamentos', title: 'Rascunhos', visible: true, order: 7 },
  { id: 'scheduled-reports', title: 'Relatórios Agendados', visible: true, order: 8 },
];

const LAYOUT_KEY = 'dashboard_layout';

function SortableWidget({
  id,
  children,
  title: _title,
}: {
  id: string;
  children: React.ReactNode;
  title: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`group relative ${isDragging ? 'shadow-lg ring-2 ring-primary' : ''}`}>
        <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
            aria-label="Mover"
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
        {children}
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  icon,
  value,
  subtitle,
}: {
  title: string;
  icon: React.ReactNode;
  value: string;
  subtitle?: string;
}) {
  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </>
  );
}

const FULL_WIDTH_WIDGET_IDS = new Set([
  'quick-actions',
  'upcoming-dates',
  'recent-kits',
  'my-quotes',
  'my-discounts',
]);

export function CustomizableDashboard() {
  const { user } = useAuth();
  const [widgetOrder, setWidgetOrder] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [metrics, setMetrics] = useState({ quotes: 0, quotesDraft: 0 });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Load saved layout
  useEffect(() => {
    const saved = localStorage.getItem(LAYOUT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as WidgetConfig[];
        // Merge with defaults (in case new widgets were added)
        const merged = DEFAULT_WIDGETS.map((dw) => {
          const savedWidget = parsed.find((p) => p.id === dw.id);
          return savedWidget
            ? { ...dw, visible: savedWidget.visible, order: savedWidget.order }
            : dw;
        }).sort((a, b) => a.order - b.order);
        setWidgetOrder(merged);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const orgId = useCurrentOrgId();

  const salesScope = useSalesScope();

  // Fetch real metrics — RLS faz o isolamento; só filtramos manualmente quando o escopo é "self".
  useEffect(() => {
    if (!user) return;
    const fetchMetrics = async () => {
      // rls-allow: respeita can_view_all_sales; RLS filtra por seller
      let quotesQ = supabase.from('quotes').select('id', { count: 'exact', head: true });
      let draftQ = supabase
        // rls-allow: respeita can_view_all_sales; RLS filtra por seller
        .from('quotes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'draft');
      if (salesScope === 'self') {
        quotesQ = quotesQ.eq('seller_id', user.id);
        draftQ = draftQ.eq('seller_id', user.id);
      }
      if (orgId) {
        quotesQ = quotesQ.eq('organization_id', orgId);
        draftQ = draftQ.eq('organization_id', orgId);
      }
      const [quotesRes, draftRes] = await Promise.all([quotesQ, draftQ]);
      setMetrics({
        quotes: quotesRes.count || 0,
        quotesDraft: draftRes.count || 0,
      });
    };
    fetchMetrics();
  }, [user, orgId, salesScope]);

  const saveLayout = useCallback((configs: WidgetConfig[]) => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(configs));
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setWidgetOrder((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
          ...item,
          order: idx,
        }));
        saveLayout(newItems);
        return newItems;
      });
    }
  };

  const toggleWidget = (widgetId: string) => {
    setWidgetOrder((prev) => {
      const updated = prev.map((w) => (w.id === widgetId ? { ...w, visible: !w.visible } : w));
      saveLayout(updated);
      return updated;
    });
  };

  const resetLayout = () => {
    setWidgetOrder(DEFAULT_WIDGETS);
    localStorage.removeItem(LAYOUT_KEY);
    toast.success('Layout restaurado para o padrão');
  };

  const visibleWidgets = useMemo(() => widgetOrder.filter((w) => w.visible), [widgetOrder]);

  const renderWidgetContent = (widgetId: string) => {
    switch (widgetId) {
      case 'quick-actions':
        return <QuickActionsPanel />;
      case 'upcoming-dates':
        return <UpcomingDatesWidget variant="compact" daysAhead={60} maxItems={6} />;
      case 'recent-kits':
        return <RecentKitsWidget />;
      case 'my-quotes':
        return <MyRecentQuotesWidget />;
      case 'my-discounts':
        return <MyDiscountRequestsWidget />;
      case 'my-clients':
        return <MyClientsWidget />;
      case 'scheduled-reports':
        return <ScheduledReportsManager />;
      case 'vendas':
        return (
          <MetricCard
            title="Total de Orçamentos"
            icon={<FileText className="h-4 w-4 text-primary" />}
            value={metrics.quotes.toLocaleString('pt-BR')}
            subtitle={`${metrics.quotesDraft} rascunhos`}
          />
        );
      case 'orcamentos':
        return (
          <MetricCard
            title="Rascunhos"
            icon={<Target className="h-4 w-4 text-warning" />}
            value={metrics.quotesDraft.toLocaleString('pt-BR')}
            subtitle="aguardando envio"
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <PageSEO
        title="Dashboard"
        description="Painel personalizado com métricas, ações rápidas e widgets."
        path="/dashboard"
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1
              data-testid="page-title-dashboard"
              className="flex items-center gap-2 font-display text-2xl font-bold"
            >
              <LayoutDashboard className="h-6 w-6" />
              Dashboard
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {isCustomizing ? 'Personalize seu dashboard' : 'Arraste widgets para reorganizar'}
              </p>
              <ScopeBadge />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isCustomizing && (
              <Button variant="ghost" size="sm" onClick={resetLayout} className="gap-1 text-xs">
                <RotateCcw className="h-3.5 w-3.5" />
                Restaurar Padrão
              </Button>
            )}
            <Button
              variant={isCustomizing ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsCustomizing(!isCustomizing)}
              className="gap-1"
            >
              {isCustomizing ? (
                <Save className="h-3.5 w-3.5" />
              ) : (
                <LayoutDashboard className="h-3.5 w-3.5" />
              )}
              {isCustomizing ? 'Concluir' : 'Personalizar'}
            </Button>
          </div>
        </div>

        {/* Widget visibility toggles */}
        {isCustomizing && (
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 font-display text-sm font-medium">Widgets Visíveis</h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {widgetOrder.map((w) => (
                  <label key={w.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Switch checked={w.visible} onCheckedChange={() => toggleWidget(w.id)} />
                    <span className={w.visible ? '' : 'text-muted-foreground line-through'}>
                      {w.title}
                    </span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleWidgets.map((w) => w.id)} strategy={rectSortingStrategy}>
            <div className="space-y-3 sm:space-y-4">
              {visibleWidgets.map((widget) => {
                const isFullWidth = FULL_WIDTH_WIDGET_IDS.has(widget.id);

                if (isFullWidth) {
                  return (
                    <SortableWidget key={widget.id} id={widget.id} title={widget.title}>
                      <CardContent className="p-0">{renderWidgetContent(widget.id)}</CardContent>
                    </SortableWidget>
                  );
                }

                return null; // metric cards rendered below in grid
              })}

              {/* Metric cards in grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {visibleWidgets
                  .filter((w) => !FULL_WIDTH_WIDGET_IDS.has(w.id))
                  .map((widget) => (
                    <SortableWidget key={widget.id} id={widget.id} title={widget.title}>
                      {renderWidgetContent(widget.id)}
                    </SortableWidget>
                  ))}
              </div>
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </>
  );
}

export default CustomizableDashboard;
