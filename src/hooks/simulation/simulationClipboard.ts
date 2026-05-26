/**
 * simulationClipboard — Clipboard helpers for the simulator.
 */
import { toast } from 'sonner';
import type { SimulationOption, Product } from '@/types/simulation';
import { formatCurrency } from '@/lib/format';

export async function copyOptionToClipboard(
  option: SimulationOption,
  quantity: number,
  setCopiedId: (id: string | null) => void,
) {
  const text = `
${option.techniqueName}
- Quantidade: ${quantity} un.
- Cores: ${option.colors}
- Tamanho: ${option.width} x ${option.height} cm
- Posições: ${option.positions}
- Preço produto/un: ${formatCurrency(option.productUnitPrice)}
- Custo personalização/un: ${formatCurrency(option.costPerUnit)}
- Setup: ${formatCurrency(option.setupCost)}
- Total produtos: ${formatCurrency(option.totalProductCost)}
- Total personalização: ${formatCurrency(option.totalPersonalizationCost)}
- TOTAL GERAL: ${formatCurrency(option.grandTotal)}
- Custo final/un: ${formatCurrency(option.grandTotalPerUnit)}
- Prazo: ~${option.estimatedDays} dias
  `.trim();

  await navigator.clipboard.writeText(text);
  setCopiedId(option.id);
  toast.success('Copiado para área de transferência');
  setTimeout(() => setCopiedId(null), 2000);
}

export async function copyAllOptionsToClipboard(
  options: SimulationOption[],
  product: Product | undefined,
  effectivePrice: number,
  quantity: number,
) {
  if (options.length === 0) return;

  const header = `Simulação de Personalização
Produto: ${product?.name} (${product?.sku})
Preço unitário: ${formatCurrency(effectivePrice)}
Quantidade: ${quantity} unidades
---\n`;

  const optionsText = options
    .sort((a, b) => a.grandTotal - b.grandTotal)
    .map((opt, idx) =>
      `
Opção ${idx + 1}: ${opt.techniqueName}
- Cores: ${opt.colors}
- Tamanho: ${opt.width} x ${opt.height} cm
- Posições: ${opt.positions}
- Preço produto/un: ${formatCurrency(opt.productUnitPrice)}
- Personalização/un: ${formatCurrency(opt.costPerUnit)}
- Setup: ${formatCurrency(opt.setupCost)}
- Total produtos: ${formatCurrency(opt.totalProductCost)}
- Total personalização: ${formatCurrency(opt.totalPersonalizationCost)}
- TOTAL GERAL: ${formatCurrency(opt.grandTotal)}
- Custo final/un: ${formatCurrency(opt.grandTotalPerUnit)}
- Prazo estimado: ~${opt.estimatedDays} dias
    `.trim(),
    )
    .join('\n\n');

  await navigator.clipboard.writeText(header + optionsText);
  toast.success('Todas as opções copiadas!');
}
