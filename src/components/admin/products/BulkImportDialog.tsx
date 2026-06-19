/**
 * BulkImportDialog — Sistema robusto de importação em massa de produtos.
 * Refatorado em sub-componentes para manutenibilidade.
 */
import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  type ImportMode,
  type ImportRow,
  type BatchImportProgress,
  type BatchImportResult,
  checkExistingSkus,
  executeBatchImport,
} from '@/lib/external-db/batch-import';
import {
  TARGET_FIELDS,
  type Step,
  type ColumnMapping,
  type ValidationResult,
} from './bulk-import/types';
import { StepUpload } from './bulk-import/StepUpload';
import { StepMapping } from './bulk-import/StepMapping';
import { StepPreview } from './bulk-import/StepPreview';
import { StepImporting, StepComplete } from './bulk-import/StepComplete';
import { logger } from '@/lib/logger';

const NUMERIC_FIELDS = [
  'cost_price',
  'stock_quantity',
  'min_quantity',
  'height_cm',
  'width_cm',
  'length_cm',
  'diameter_cm',
  'weight_g',
  'capacity_ml',
  'box_width_mm',
  'box_height_mm',
  'box_length_mm',
  'box_weight_kg',
  'box_quantity',
  'box_volume_cm3',
] as const;

const BOOLEAN_FIELDS = [
  'is_active',
  'is_featured',
  'is_bestseller',
  'is_new',
  'is_on_sale',
  'is_kit',
  'has_commercial_packaging',
] as const;

const URL_FIELDS = ['image_url', 'primary_image_url', 'og_image_url', 'box_image'] as const;

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function BulkImportDialog({ open, onOpenChange, onComplete }: BulkImportDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [rawData, setRawData] = useState<Array<Record<string, unknown>>>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [importMode, setImportMode] = useState<ImportMode>('upsert');
  const [progress, setProgress] = useState<BatchImportProgress | null>(null);
  const [importResult, setImportResult] = useState<BatchImportResult | null>(null);
  const [isCheckingSkus, setIsCheckingSkus] = useState(false);
  const [_existingSkus, setExistingSkus] = useState<Set<string>>(new Set());

  const reset = useCallback(() => {
    setStep('upload');
    setRawData([]);
    setHeaders([]);
    setFileName('');
    setMapping({});
    setValidationResults([]);
    setProgress(null);
    setImportResult(null);
    setIsCheckingSkus(false);
    setExistingSkus(new Set());
  }, []);

  // ── Upload complete handler ──
  const handleFileProcessed = useCallback(
    (h: string[], rows: Array<Record<string, unknown>>, name: string, m: ColumnMapping) => {
      setHeaders(h);
      setRawData(rows);
      setFileName(name);
      setMapping(m);
      setStep('mapping');
    },
    [],
  );

  // ── Validate data + check existing SKUs ──
  const validateData = useCallback(async () => {
    setIsCheckingSkus(true);
    const results: ValidationResult[] = [];
    const requiredFields = TARGET_FIELDS.filter((f) => f.required).map((f) => f.key);
    const allSkus: string[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const errors: string[] = [];
      const warnings: string[] = [];
      const mapped: Record<string, unknown> = {};

      for (const [sourceCol, targetField] of Object.entries(mapping)) {
        if (targetField) mapped[targetField] = row[sourceCol];
      }

      for (const field of requiredFields) {
        const value = mapped[field];
        if (value === undefined || value === null || String(value).trim() === '') {
          errors.push(`"${TARGET_FIELDS.find((f) => f.key === field)?.label}" obrigatório`);
        }
      }

      if (mapped.sale_price !== undefined && mapped.sale_price !== '') {
        const price = parseFloat(String(mapped.sale_price).replace(',', '.'));
        if (Number.isNaN(price) || price < 0) {
          errors.push('Preço inválido');
        } else {
          mapped.sale_price = price;
        }
      }

      for (const numField of NUMERIC_FIELDS) {
        if (mapped[numField] !== undefined && mapped[numField] !== '') {
          const val = parseFloat(String(mapped[numField]).replace(',', '.'));
          if (Number.isNaN(val)) {
            warnings.push(
              `"${TARGET_FIELDS.find((f) => f.key === numField)?.label}" ignorado (inválido)`,
            );
            mapped[numField] = null;
          } else {
            mapped[numField] = val;
          }
        }
      }

      for (const boolField of BOOLEAN_FIELDS) {
        if (mapped[boolField] !== undefined && mapped[boolField] !== '') {
          const raw = String(mapped[boolField]).toLowerCase().trim();
          mapped[boolField] = ['true', '1', 'sim', 'yes', 's', 'y', 'x'].includes(raw);
        }
      }

      for (const urlField of URL_FIELDS) {
        if (mapped[urlField] && typeof mapped[urlField] === 'string') {
          const url = String(mapped[urlField]).trim();
          if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
            warnings.push(
              `"${TARGET_FIELDS.find((f) => f.key === urlField)?.label}" não parece ser uma URL válida`,
            );
          }
        }
      }

      const sku = mapped.sku ? String(mapped.sku).trim() : '';
      if ((sku?.length ?? 0) > 50) errors.push('SKU excede 50 caracteres');
      if (mapped.name && String(mapped.name).length > 300) {
        warnings.push('Nome truncado em 300 caracteres');
        mapped.name = String(mapped.name).slice(0, 300);
      }
      if (sku) allSkus.push(sku);
      const skuCount = allSkus.filter((s) => s === sku).length;
      if (skuCount > 1) warnings.push('SKU duplicado dentro do arquivo');

      // `mapped` holds CSV/Excel values typed as `unknown`; they are coerced above,
      // so assert the assembled row to the typed ImportRow shape.
      const importRow: ImportRow | undefined =
        errors.length === 0
          ? ({
              sku,
              name: String(mapped.name).trim(),
              sale_price: mapped.sale_price ?? 0,
              description: mapped.description || null,
              short_description: mapped.short_description || null,
              meta_description: mapped.meta_description || null,
              brand: mapped.brand || null,
              supplier_reference: mapped.supplier_reference || null,
              supplier_id: mapped.supplier_id || null,
              cost_price: mapped.cost_price ?? null,
              stock_quantity: mapped.stock_quantity ?? 0,
              min_quantity: mapped.min_quantity ?? 1,
              category_id: mapped.category_id || null,
              main_category_id: mapped.main_category_id || null,
              height_cm: mapped.height_cm ?? null,
              width_cm: mapped.width_cm ?? null,
              length_cm: mapped.length_cm ?? null,
              diameter_cm: mapped.diameter_cm ?? null,
              weight_g: mapped.weight_g ?? null,
              capacity_ml: mapped.capacity_ml ?? null,
              packing_type: mapped.packing_type || null,
              packing_classification: mapped.packing_classification || null,
              has_commercial_packaging: mapped.has_commercial_packaging ?? null,
              repacking_type: mapped.repacking_type || null,
              packaging_context: mapped.packaging_context || null,
              box_width_mm: mapped.box_width_mm ?? null,
              box_height_mm: mapped.box_height_mm ?? null,
              box_length_mm: mapped.box_length_mm ?? null,
              box_weight_kg: mapped.box_weight_kg ?? null,
              box_quantity: mapped.box_quantity ?? null,
              box_volume_cm3: mapped.box_volume_cm3 ?? null,
              box_image: mapped.box_image || null,
              image_url: mapped.image_url || null,
              primary_image_url: mapped.primary_image_url || mapped.image_url || null,
              og_image_url: mapped.og_image_url || null,
              is_active: mapped.is_active ?? true,
              active: mapped.is_active ?? true,
              is_featured: mapped.is_featured ?? null,
              is_bestseller: mapped.is_bestseller ?? null,
              is_new: mapped.is_new ?? null,
              is_on_sale: mapped.is_on_sale ?? null,
              is_kit: mapped.is_kit ?? null,
              gender: mapped.gender || null,
              dimensions: mapped.dimensions || null,
            } as ImportRow)
          : undefined;

      results.push({
        row: i + 1,
        valid: errors.length === 0,
        errors,
        warnings,
        data: importRow,
        existsInDb: false,
      });
    }

    try {
      const uniqueSkus = [...new Set(allSkus.filter(Boolean))];
      if (uniqueSkus.length > 0) {
        const existing = await checkExistingSkus(uniqueSkus);
        setExistingSkus(existing);
        for (const r of results) {
          if (r.data?.sku && existing.has(r.data.sku)) r.existsInDb = true;
        }
      }
    } catch (err) {
      logger.warn('SKU dedup check failed:', err);
      toast.warning('Não foi possível verificar SKUs existentes');
    }

    setIsCheckingSkus(false);
    setValidationResults(results);
    setStep('preview');
  }, [rawData, mapping]);

  // ── Execute Import ──
  const executeImport = useCallback(async () => {
    let rowsToImport: ImportRow[];
    if (importMode === 'insert') {
      rowsToImport = validationResults.flatMap((r) =>
        r.valid && r.data && !r.existsInDb ? [r.data] : [],
      );
    } else {
      rowsToImport = validationResults.flatMap((r) => (r.valid && r.data ? [r.data] : []));
    }
    if (rowsToImport.length === 0) {
      toast.error('Nenhuma linha para importar');
      return;
    }

    setStep('importing');
    const result = await executeBatchImport(rowsToImport, importMode, (p) => setProgress({ ...p }));
    setImportResult(result);
    setStep('complete');
    if (result.succeeded > 0) {
      toast.success(`${result.succeeded} produto(s) importado(s)!`);
      onComplete();
    }
    if (result.failed > 0) {
      toast.error(`${result.failed} produto(s) falharam`);
    }
  }, [validationResults, importMode, onComplete]);

  const requiredMapped = TARGET_FIELDS.filter((f) => f.required).every((f) =>
    Object.values(mapping).includes(f.key),
  );
  const invalidCount = validationResults.filter((r) => !r.valid).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importação em Massa
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Envie um arquivo CSV ou Excel com os dados dos produtos'}
            {step === 'mapping' && `Mapeie as colunas de "${fileName}" para os campos do sistema`}
            {step === 'preview' && 'Revise os dados e escolha o modo de importação'}
            {step === 'importing' && 'Importando produtos em lotes...'}
            {step === 'complete' && 'Importação concluída'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1 text-xs">
          {(['upload', 'mapping', 'preview', 'importing'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              <Badge
                variant={
                  step === s || (step === 'complete' && s === 'importing') ? 'default' : 'outline'
                }
                className={cn(
                  'text-[10px]',
                  ['mapping', 'preview', 'importing', 'complete'].indexOf(step) >
                    ['upload', 'mapping', 'preview', 'importing'].indexOf(s) &&
                    'border-success/30 bg-success/20 text-success',
                )}
              >
                {s === 'upload' && '1. Upload'}
                {s === 'mapping' && '2. Mapear'}
                {s === 'preview' && '3. Validar'}
                {s === 'importing' && '4. Importar'}
              </Badge>
            </div>
          ))}
        </div>

        {step === 'upload' && <StepUpload onFileProcessed={handleFileProcessed} />}

        {step === 'mapping' && (
          <StepMapping
            headers={headers}
            rawData={rawData}
            mapping={mapping}
            setMapping={setMapping}
            requiredMapped={requiredMapped}
            isCheckingSkus={isCheckingSkus}
            onBack={() => setStep('upload')}
            onValidate={validateData}
          />
        )}

        {step === 'preview' && (
          <StepPreview
            validationResults={validationResults}
            rawData={rawData}
            mapping={mapping}
            importMode={importMode}
            setImportMode={setImportMode}
            onBack={() => setStep('mapping')}
            onImport={executeImport}
          />
        )}

        {step === 'importing' && progress && <StepImporting progress={progress} />}

        {step === 'complete' && importResult && (
          <StepComplete
            importResult={importResult}
            importMode={importMode}
            invalidCount={invalidCount}
            validationResults={validationResults}
            rawData={rawData}
            onReset={reset}
            onClose={() => {
              reset();
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
