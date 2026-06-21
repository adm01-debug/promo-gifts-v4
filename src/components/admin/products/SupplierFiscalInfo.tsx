/**
 * Fiscal info panel for a supplier source — with inline editing.
 * Shows CST, CFOP, ICMS, PIS, COFINS, CEST, CSOSN, operation_nature
 * from variant_supplier_sources + supplier_branches.
 * Shows "Herdado" badge when data comes from branch defaults.
 * Allows overriding inherited values per product.
 */
import { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Building2,
  FileText,
  Loader2,
  ArrowDownFromLine,
  Pencil,
  Save,
  X,
  RotateCcw,
} from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useSupplierFiscalData, type FiscalOverrideInput } from '@/hooks/products';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  productId: string | undefined;
  supplierId: string | undefined;
}

// ── Inline edit field ──────────────────────────────────────────────────────────

function EditField({
  label,
  value,
  onChange,
  mono = false,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  placeholder?: string;
  type?: 'number' | 'text';
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="whitespace-nowrap text-[10px] text-muted-foreground">{label}</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        type={type}
        step={type === 'number' ? '0.01' : undefined}
        className={cn('h-7 w-24 px-2 text-xs', mono && 'font-mono')}
      />
    </div>
  );
}

// ── Read-only helpers ──────────────────────────────────────────────────────────

function FiscalFieldPair({
  label1,
  value1,
  label2,
  value2,
  mono = false,
}: {
  label1: string;
  value1: string | null | undefined;
  label2: string;
  value2: string | null | undefined;
  mono?: boolean;
}) {
  if (!value1 && !value2) return null;
  return (
    <div className="flex items-baseline gap-1.5">
      {value1 && (
        <>
          <span className="whitespace-nowrap text-[11px] text-muted-foreground">{label1}:</span>
          <span className={cn('text-xs font-medium', mono && 'font-mono')}>{value1}</span>
        </>
      )}
      {value1 && value2 && <span className="mx-0.5 text-[10px] text-muted-foreground/50">/</span>}
      {value2 && (
        <>
          <span className="whitespace-nowrap text-[11px] text-muted-foreground">{label2}:</span>
          <span className={cn('text-xs font-medium', mono && 'font-mono')}>{value2}</span>
        </>
      )}
    </div>
  );
}

function FiscalField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: number | string | null | undefined;
  mono?: boolean;
}) {
  if (value === null || value === '') return null;
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="whitespace-nowrap text-[11px] text-muted-foreground">{label}:</span>
      <span className={cn('text-xs font-medium', mono && 'font-mono')}>{value}</span>
    </div>
  );
}

function formatRate(rate: number | null | undefined): string | null {
  if (rate === null) return null;
  return `${rate}%`;
}

const TAX_REGIME_LABELS: Record<string, string> = {
  simples_nacional: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
  mei: 'MEI',
} as const;

function formatTaxRegime(regime: string | null): string | null {
  if (!regime) return null;
  return TAX_REGIME_LABELS[regime] || regime;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SupplierFiscalInfo({ productId, supplierId }: Props) {
  const { data, isLoading, saveFiscalOverride, revertToInherited } = useSupplierFiscalData(
    productId,
    supplierId,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRevertDialog, setShowRevertDialog] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  // Edit form state
  const [form, setForm] = useState<FiscalOverrideInput>({
    cst: null,
    cfop: null,
    icms_rate: null,
    pis_rate: null,
    cofins_rate: null,
    cest: null,
    csosn: null,
    operation_nature: null,
  });

  const startEditing = useCallback(() => {
    if (!data) return;
    setForm({
      cst: data.cst,
      cfop: data.cfop,
      icms_rate: data.icms_rate,
      pis_rate: data.pis_rate,
      cofins_rate: data.cofins_rate,
      cest: data.cest,
      csosn: data.csosn,
      operation_nature: data.operation_nature,
    });
    setIsEditing(true);
  }, [data]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const success = await saveFiscalOverride(form);
      if (success) {
        toast.success('Dados fiscais salvos com sucesso');
        setIsEditing(false);
      } else {
        toast.error(
          'Erro ao salvar dados fiscais. Verifique se o produto possui variantes cadastradas.',
        );
      }
    } catch {
      toast.error('Erro ao salvar dados fiscais');
    } finally {
      setIsSaving(false);
    }
  }, [form, saveFiscalOverride]);

  const handleRevert = useCallback(async () => {
    setIsReverting(true);
    try {
      const success = await revertToInherited();
      if (success) {
        toast.success('Dados revertidos para herança da filial');
        setShowRevertDialog(false);
      } else {
        toast.error('Erro ao reverter dados fiscais');
      }
    } catch {
      toast.error('Erro ao reverter dados fiscais');
    } finally {
      setIsReverting(false);
    }
  }, [revertToInherited]);

  const updateField = useCallback((field: keyof FiscalOverrideInput, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]:
        value === ''
          ? null
          : ['icms_rate', 'pis_rate', 'cofins_rate'].includes(field)
            ? parseFloat(value) || null
            : value,
    }));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando dados fiscais...
      </div>
    );
  }

  if (!data) return null;

  const hasFiscal = data.cst || data.cfop || data.icms_rate !== null || data.pis_rate !== null;
  const hasBranch = data.branch_name || data.branch_cnpj;

  if (!hasFiscal && !hasBranch && !isEditing) return null;

  return (
    <div className="mt-2 space-y-2 border-t border-border/50 pt-2">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <FileText className="h-3 w-3 text-muted-foreground" />
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Fiscal do Fornecedor
        </span>
        {data.isInherited && !isEditing && (
          <Badge
            variant="outline"
            className="ml-1 h-5 gap-1 border-warning/30 bg-warning/5 text-[10px] text-warning"
          >
            <ArrowDownFromLine className="h-2.5 w-2.5" />
            Herdado da filial
          </Badge>
        )}
        {isEditing && (
          <Badge
            variant="outline"
            className="ml-1 h-5 gap-1 border-info/30 bg-info/5 text-[10px] text-info"
          >
            <Pencil className="h-2.5 w-2.5" />
            Editando
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1">
          {!isEditing ? (
            <div className="flex items-center gap-1">
              {!data.isInherited && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[10px] text-destructive hover:text-destructive"
                  onClick={() => setShowRevertDialog(true)}
                >
                  <RotateCcw className="h-3 w-3" />
                  Reverter
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-[10px]"
                onClick={startEditing}
              >
                <Pencil className="h-3 w-3" />
                {data.isInherited ? 'Sobrescrever' : 'Editar'}
              </Button>
            </div>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-[10px]"
                onClick={cancelEditing}
                disabled={isSaving}
              >
                <X className="h-3 w-3" />
                Cancelar
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-6 gap-1 px-2 text-[10px]"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Salvar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Branch info (always read-only) */}
      {hasBranch && (
        <div className="flex flex-wrap items-center gap-2">
          <Building2 className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium">{data.branch_name}</span>
          {data.branch_cnpj && (
            <Badge variant="outline" className="h-5 font-mono text-[10px]">
              {data.branch_cnpj}
            </Badge>
          )}
          {data.branch_state_uf && (
            <Badge variant="secondary" className="h-5 text-[10px]">
              {data.branch_state_uf}
            </Badge>
          )}
          {data.branch_tax_regime && (
            <Badge variant="secondary" className="h-5 text-[10px]">
              {formatTaxRegime(data.branch_tax_regime)}
            </Badge>
          )}
        </div>
      )}

      {/* ── EDIT MODE ── */}
      {isEditing ? (
        <div className="grid grid-cols-2 gap-3 rounded-md border border-border/50 bg-muted/30 p-3 sm:grid-cols-4">
          <EditField
            label="CST"
            value={form.cst || ''}
            onChange={(v) => updateField('cst', v)}
            mono
            placeholder="Ex: 060"
          />
          <EditField
            label="CFOP"
            value={form.cfop || ''}
            onChange={(v) => updateField('cfop', v)}
            mono
            placeholder="Ex: 5102"
          />
          <EditField
            label="ICMS (%)"
            value={form.icms_rate !== null ? String(form.icms_rate) : ''}
            onChange={(v) => updateField('icms_rate', v)}
            type="number"
            placeholder="Ex: 17"
          />
          <EditField
            label="PIS (%)"
            value={form.pis_rate !== null ? String(form.pis_rate) : ''}
            onChange={(v) => updateField('pis_rate', v)}
            type="number"
            placeholder="Ex: 0.65"
          />
          <EditField
            label="COFINS (%)"
            value={form.cofins_rate !== null ? String(form.cofins_rate) : ''}
            onChange={(v) => updateField('cofins_rate', v)}
            type="number"
            placeholder="Ex: 3"
          />
          <EditField
            label="CEST"
            value={form.cest || ''}
            onChange={(v) => updateField('cest', v)}
            mono
            placeholder="Ex: 2804200"
          />
          <EditField
            label="CSOSN"
            value={form.csosn || ''}
            onChange={(v) => updateField('csosn', v)}
            mono
            placeholder="Ex: 500"
          />
          <EditField
            label="Natureza da Op."
            value={form.operation_nature || ''}
            onChange={(v) => updateField('operation_nature', v)}
            placeholder="Ex: Venda de Merc."
          />
        </div>
      ) : (
        /* ── READ MODE ── */
        <>
          {hasFiscal && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <FiscalField label="CST" value={data.cst} mono />
              {data.isInherited && data.cfop_interstate ? (
                <FiscalFieldPair
                  label1="CFOP Int."
                  value1={data.cfop}
                  label2="Interestadual"
                  value2={data.cfop_interstate}
                  mono
                />
              ) : (
                <FiscalField label="CFOP" value={data.cfop} mono />
              )}
              <FiscalField label="ICMS" value={formatRate(data.icms_rate)} />
              <FiscalField label="PIS" value={formatRate(data.pis_rate)} />
              <FiscalField label="COFINS" value={formatRate(data.cofins_rate)} />
              {data.cest && <FiscalField label="CEST" value={data.cest} mono />}
              {data.csosn && <FiscalField label="CSOSN" value={data.csosn} mono />}
              {data.operation_nature && (
                <FiscalField label="Natureza" value={data.operation_nature} />
              )}
            </div>
          )}
        </>
      )}

      {/* Branch reference rates (always read-only) */}
      {!isEditing &&
        (data.branch_icms_internal !== null || data.branch_icms_interstate !== null) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            <FiscalField label="ICMS Ref. Interno" value={formatRate(data.branch_icms_internal)} />
            <FiscalField
              label="ICMS Ref. Interestadual"
              value={formatRate(data.branch_icms_interstate)}
            />
          </div>
        )}

      {/* Inheritance hint */}
      {data.isInherited && !isEditing && (
        <p className="text-[10px] italic text-muted-foreground/70">
          Dados herdados da filial padrão. Clique em "Sobrescrever" para definir valores específicos
          para este produto.
        </p>
      )}

      {/* Revert confirmation dialog */}
      <DeleteConfirmDialog
        open={showRevertDialog}
        onOpenChange={setShowRevertDialog}
        entityName="sobrescrita fiscal"
        itemName="dados fiscais específicos"
        onConfirm={handleRevert}
        loading={isReverting}
        affectedItems={[
          'Os dados fiscais específicos deste produto serão removidos',
          'O sistema voltará a usar os dados herdados da filial',
        ]}
      />
    </div>
  );
}
