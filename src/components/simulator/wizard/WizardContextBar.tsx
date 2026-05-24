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
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/format';
import type { UseSimulatorWizardReturn } from '@/hooks/simulator/useSimulatorWizard';

interface WizardContextBarProps {
  wizard: UseSimulatorWizardReturn;
}

export function WizardContextBar({ wizard }: WizardContextBarProps) {
  const { selectedProduct, quantity, effectivePrice, selectedLocation, engravingSpecs, currentStep } = wizard;
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
    if (!isNaN(parsed) && parsed > 0) {
      wizard.setQuantity(parsed);
    }
    setEditingQty(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-muted/60 border border-border/50"
    >
      {/* Product image/icon */}
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        {selectedProduct.imageUrl ? (
          
<img src={selectedProduct.imageUrl} alt="" className="w-8 h-8 rounded object-cover"  loading="lazy"/>
        ) : (
          <Package className="h-5 w-5 text-primary" />
        )}
      </div>

      {/* Product name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{selectedProduct.name}</p>
        <p className="text-xs text-muted-foreground font-mono">{selectedProduct.sku}</p>
      </div>

      {/* Dynamic context chips */}
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {/* Quantity - editable */}
        {editingQty ? (
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef}
              type="number"
              min={1}
              value={tempQty}
              onChange={e => setTempQty(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitQty(); if (e.key === 'Escape') setEditingQty(false); }}
              onBlur={commitQty}
              className="h-7 w-20 text-xs text-center"
            />
            <button onClick={commitQty} className="p-1 rounded hover:bg-muted" aria-label="Confirmar">
              <Check className="h-3.5 w-3.5 text-primary" />
            </button>
          </div>
        ) : (
          <Badge
            variant="secondary"
            className="gap-1 cursor-pointer hover:bg-primary/10 transition-colors text-xs"
            onClick={() => setEditingQty(true)}
          >
            <Hash className="h-3 w-3" />
            {quantity} un.
            <Pencil className="h-2.5 w-2.5 ml-0.5 opacity-50" />
          </Badge>
        )}

        {/* Unit price */}
        <Badge variant="outline" className="text-xs gap-1">
          {formatCurrency(effectivePrice)}/un
        </Badge>

        {/* Location (when selected) */}
        {selectedLocation && currentStep !== 'product' && (
          <Badge variant="outline" className="text-xs gap-1 hidden sm:flex">
            <MapPin className="h-3 w-3" />
            {selectedLocation.locationName}
          </Badge>
        )}

        {/* Specs (when on specs/comparison) */}
        {(currentStep === 'specs' || currentStep === 'comparison') && selectedLocation && (
          <>
            <Badge variant="outline" className="text-xs gap-1 hidden md:flex">
              <Palette className="h-3 w-3" />
              {engravingSpecs.colors}
            </Badge>
            <Badge variant="outline" className="text-xs gap-1 hidden md:flex">
              <Ruler className="h-3 w-3" />
              {engravingSpecs.width}×{engravingSpecs.height}cm
            </Badge>
          </>
        )}
      </div>
    </motion.div>
  );
}
