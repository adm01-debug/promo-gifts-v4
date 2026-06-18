/**
 * AdminTemplatesManager — Refactored orchestrator
 * Table/Grid views extracted to ./admin-templates/
 */
import { useState, useMemo } from 'react';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { TemplateDeleteDialog, TemplateCloneDialog } from './AdminTemplateDialogs';
import { FileText, Search, Users, User, Filter, LayoutGrid, List, Download } from 'lucide-react';
import { type QuoteTemplate, useQuoteTemplates } from '@/hooks/quotes';
import { exportTemplatesToJson } from '@/utils/templateExport';
import { TemplateTableView } from './admin-templates/TemplateTableView';
import { TemplateGridView } from './admin-templates/TemplateGridView';

interface AdminTemplatesManagerProps {
  onEditTemplate?: (template: QuoteTemplate) => void;
}

export function AdminTemplatesManager({ onEditTemplate }: AdminTemplatesManagerProps) {
  const { allTemplates, sellers, loading, deleteTemplate, cloneTemplateToSeller } =
    useQuoteTemplates();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSellerId, setSelectedSellerId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneTemplateId, setCloneTemplateId] = useState<string | null>(null);
  const [targetSellerId, setTargetSellerId] = useState<string>('');

  const getSellerName = (sellerId: string) => {
    const seller = sellers.find((s) => s.id === sellerId);
    return seller?.full_name || seller?.email || 'Vendedor desconhecido';
  };

  const filteredTemplates = useMemo(
    () =>
      allTemplates.filter((t) => {
        const matchesSearch =
          t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSeller = selectedSellerId === 'all' || t.seller_id === selectedSellerId;
        return matchesSearch && matchesSeller;
      }),
    [allTemplates, searchTerm, selectedSellerId],
  );

  const templatesBySeller = useMemo(() => {
    const grouped: Record<string, QuoteTemplate[]> = {};
    filteredTemplates.forEach((t) => {
      if (!grouped[t.seller_id]) grouped[t.seller_id] = [];
      grouped[t.seller_id].push(t);
    });
    return grouped;
  }, [filteredTemplates]);

  const calculateTotal = (template: QuoteTemplate) => {
    const itemsTotal = template.items.reduce((sum, item) => {
      const personalizationCost =
        item.personalizations?.reduce(
          (pSum, p) => pSum + (p.unitCost ?? 0) * item.quantity + (p.setupCost ?? 0),
          0,
        ) || 0;
      return sum + item.quantity * item.unitPrice + personalizationCost;
    }, 0);
    const discountValue =
      template.discount_percent > 0
        ? itemsTotal * (template.discount_percent / 100)
        : template.discount_amount;
    return itemsTotal - discountValue;
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteTemplate(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };
  const handleClone = async () => {
    if (cloneTemplateId && targetSellerId) {
      await cloneTemplateToSeller(cloneTemplateId, targetSellerId);
      setCloneDialogOpen(false);
      setCloneTemplateId(null);
      setTargetSellerId('');
    }
  };

  if (loading)
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-48" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filtrar por vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Todos os vendedores
                </span>
              </SelectItem>
              <Separator className="my-1" />
              {sellers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {s.full_name || s.email}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filteredTemplates.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportTemplatesToJson(
                  filteredTemplates,
                  `templates-all-${new Date().toISOString().split('T')[0]}.json`,
                )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          )}
          <div className="flex items-center rounded-md border">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              aria-label="Lista"
              className="h-9 w-9 rounded-r-none"
              onClick={() => setViewMode('table')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              aria-label="Grid"
              className="h-9 w-9 rounded-l-none"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{filteredTemplates.length} templates encontrados</span>
        <span>•</span>
        <span>{Object.keys(templatesBySeller).length} vendedores</span>
      </div>

      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 font-display text-lg font-medium">Nenhum template encontrado</h3>
            <p className="text-muted-foreground">
              {searchTerm || selectedSellerId !== 'all'
                ? 'Tente ajustar os filtros de busca'
                : 'Não há templates cadastrados no sistema'}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'table' ? (
        <TemplateTableView
          templates={filteredTemplates}
          getSellerName={getSellerName}
          formatCurrency={formatCurrency}
          calculateTotal={calculateTotal}
          onEdit={onEditTemplate}
          onClone={(id) => {
            setCloneTemplateId(id);
            setCloneDialogOpen(true);
          }}
          onDelete={setDeleteConfirmId}
        />
      ) : (
        <TemplateGridView
          templatesBySeller={templatesBySeller}
          getSellerName={getSellerName}
          formatCurrency={formatCurrency}
          calculateTotal={calculateTotal}
          onEdit={onEditTemplate}
          onClone={(id) => {
            setCloneTemplateId(id);
            setCloneDialogOpen(true);
          }}
          onDelete={setDeleteConfirmId}
        />
      )}

      <TemplateDeleteDialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
      />
      <TemplateCloneDialog
        open={cloneDialogOpen}
        onClose={() => {
          setCloneDialogOpen(false);
          setCloneTemplateId(null);
          setTargetSellerId('');
        }}
        onConfirm={handleClone}
        sellers={sellers}
        targetSellerId={targetSellerId}
        setTargetSellerId={setTargetSellerId}
      />
    </div>
  );
}
