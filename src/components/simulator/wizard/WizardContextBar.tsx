/**
 * WizardContextBar - Barra de contexto unificada
 *
 * Sempre visível após seleção do produto, mostrando produto + quantidade
 * com edição inline da tiragem.
 */

import { useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Package, Hash, MapPin, Palette, Ruler, Pencil, Check } from 'lucide-react';
import { m as motion } from 'framer-motion';
import { formatCurrency } from '@/lib/format';
import type { UseSimulatorWizardReturn } from '@/hooks/simulator/useSimulatorWizard';

interface WizardContextBarProps {
  wizard: UseSimulatorWizardReturn;
}

export function WizardContextBar({ wizard }: WizardContextBarProps) {
  const {
    selectedProduct,
    quantity,
    effectivePrice,
    selectedLocation,
    engravingSpecs,
    currentStep,
  } = wizard;
  const [editingQty, setEditingQty] = useState(false);
  const [tempQty, setTempQty] = useState(String(quantity));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingQty) {
      setTempQty(String(quantity));
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingQty, quantity]);

  if (!selectedProduct) return null;

  const commitQty = () => {
    const parsed = parseInt(tempQty, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      wizard.setQuantity(parsed);
    }
    setEditingQty(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/60 p-3"
    >
      {/* Product image/icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        {selectedProduct.imageUrl ? (
          <img
            src={selectedProduct.imageUrl}
            alt=""
            className="h-8 w-8 rounded object-cover"
            loading="lazy"
          />
        ) : (
          <Package className="h-5 w-5 text-primary" />
        )}
      </div>

      {/* Product name */}
      <div className="min-w-0 flex-1">
        <p data-testid="simulator-product-name" className="truncate text-sm font-semibold">
          {selectedProduct.name}
        </p>
        <p data-testid="simulator-product-sku" className="font-mono text-xs text-muted-foreground">
          {selectedProduct.sku}
        </p>
      </div>

      {/* Dynamic context chips */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* Quantity - editable */}
        {editingQty ? (
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef}
              type="number"
              min={1}
              value={tempQty}
              onChange={(e) => setTempQty(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitQty();
                if (e.key === 'Escape') setEditingQty(false);
              }}
              onBlur={commitQty}
              className="h-7 w-20 text-center text-xs"
            />
            <button
              onClick={commitQty}
              className="rounded p-1 hover:bg-muted"
              aria-label="Confirmar"
            >
              <Check className="h-3.5 w-3.5 text-primary" />
            </button>
          </div>
        ) : (
          <Badge
            variant="secondary"
            className="cursor-pointer gap-1 text-xs transition-colors hover:bg-primary/10"
            onClick={() => setEditingQty(true)}
          >
            <Hash className="h-3 w-3" />
            {quantity} un.
            <Pencil className="ml-0.5 h-2.5 w-2.5 opacity-50" />
          </Badge>
        )}

        {/* Unit price */}
        <Badge variant="outline" className="gap-1 text-xs">
          {formatCurrency(effectivePrice)}/un
        </Badge>

        {/* Location (when selected) */}
        {selectedLocation && currentStep !== 'product' && (
          <Badge variant="outline" className="hidden gap-1 text-xs sm:flex">
            <MapPin className="h-3 w-3" />
            {selectedLocation.locationName}
          </Badge>
        )}

        {/* Specs (when on specs/comparison) */}
        {(currentStep === 'specs' || currentStep === 'comparison') && selectedLocation && (
          <>
            <Badge variant="outline" className="hidden gap-1 text-xs md:flex">
              <Palette className="h-3 w-3" />
              {engravingSpecs.colors}
            </Badge>
            <Badge variant="outline" className="hidden gap-1 text-xs md:flex">
              <Ruler className="h-3 w-3" />
              {engravingSpecs.width}×{engravingSpecs.height}cm
            </Badge>
          </>
        )}
      </div>
    </motion.div>
  );
}
