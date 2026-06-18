/**
 * ComparisonRadarChart — Radar visual de até 5 dimensões para múltiplos produtos.
 * Eixos: Preço (invertido), Estoque, Variedade de cores, Qtd mínima (invertido), Lead time (invertido).
 */
import { useMemo } from 'react';
import type { Product } from '@/types/product-catalog';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';

interface ComparisonRadarChartProps {
  products: Product[];
  className?: string;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
];

function leadTimeScore(status: string | undefined): number {
  // Higher is better in radar (already inverted)
  switch (status) {
    case 'in-stock':
      return 100;
    case 'low-stock':
      return 60;
    case 'out-of-stock':
      return 20;
    default:
      return 50;
  }
}

export function ComparisonRadarChart({ products, className }: ComparisonRadarChartProps) {
  const data = useMemo(() => {
    if (!products || products.length === 0) return [];

    const prices = products.map((p) => p.price);
    const stocks = products.map((p) => p.stock);
    const mins = products.map((p) => p.minQuantity);
    const colorCounts = products.map((p) => p.colors?.length ?? 0);

    const maxPrice = Math.max(...prices, 1);
    const maxStock = Math.max(...stocks, 1);
    const maxMin = Math.max(...mins, 1);
    const maxColors = Math.max(...colorCounts, 1);

    const axes = [
      { key: 'Preço', values: prices.map((v) => Math.round((1 - v / maxPrice) * 100)) },
      { key: 'Estoque', values: stocks.map((v) => Math.round((v / maxStock) * 100)) },
      { key: 'Cores', values: colorCounts.map((v) => Math.round((v / maxColors) * 100)) },
      {
        key: 'Qtd. mín',
        values: mins.map((v) => Math.round((1 - (v - 1) / Math.max(1, maxMin - 1)) * 100)),
      },
      { key: 'Lead time', values: products.map((p) => leadTimeScore(p.stockStatus)) },
    ];

    return axes.map((axis) => {
      const row: Record<string, unknown> = { axis: axis.key };
      products.forEach((p, i) => {
        row[String(p.id)] = Math.max(0, Math.min(100, axis.values[i]));
      });
      return row;
    });
  }, [products]);

  if (products.length < 2) return null;

  return (
    <div className={className}>
      <div className="rounded-2xl border bg-card p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <span className="inline-block h-4 w-1 rounded-full bg-primary" />
          Radar comparativo (0–100, maior é melhor)
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => {
                const p = products.find((x) => String(x.id) === name);
                return [value, p?.name ?? name];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => {
                const p = products.find((x) => String(x.id) === value);
                return p?.name?.slice(0, 28) ?? value;
              }}
            />
            {products.map((p, i) => (
              <Radar
                key={String(p.id)}
                name={String(p.id)}
                dataKey={String(p.id)}
                stroke={COLORS[i % COLORS.length]}
                fill={COLORS[i % COLORS.length]}
                fillOpacity={0.18}
                strokeWidth={2}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
