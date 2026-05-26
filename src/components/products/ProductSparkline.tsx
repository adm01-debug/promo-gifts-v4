import { useMemo, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useSparklineData } from "@/hooks/intelligence/useSparklineSales";
import { TrendingUp, TrendingDown, Minus, Zap, Activity } from "lucide-react";

interface ProductSparklineProps {
  productId: string;
  className?: string;
}

/**
 * Mini sparkline SVG showing recent sales activity for a product card.
 * Consumes real data from SparklineSalesProvider context when available,
 * falls back to a deterministic demo seed otherwise.
 */
export function ProductSparkline({ productId, className }: ProductSparklineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Real data from batch context
  const realData = useSparklineData(productId);
  const hasRealData = realData && realData.totalQty > 0;

  // Points: use real daily quantities only — no demo fallback
  const points = useMemo(() => {
    if (hasRealData) return realData.dailyQty;
    return [];
  }, [hasRealData, realData?.dailyQty]);


  // Extended summary stats with comparisons
  const summary = useMemo(() => {
    const totalSales = hasRealData ? realData.totalQty : 0;
    const totalReplenished = hasRealData ? realData.totalReplenished : 0;
    const availableStock = hasRealData ? realData.availableStock : 0;

    const pts = points;
    const mid = Math.floor(pts.length / 2);
    const firstHalf = pts.slice(0, mid);
    const secondHalf = pts.slice(mid);
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1);
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1);
    const trend = firstAvg > 0 ? ((secondAvg / firstAvg) - 1) * 100 : 0;

    const dailyAvg = totalSales / (pts.length || 1);
    const peakDay = Math.max(...pts);
    const activeDays = pts.filter(v => v > 0).length;
    const firstHalfTotal = firstHalf.reduce((a, b) => a + b, 0);
    const secondHalfTotal = secondHalf.reduce((a, b) => a + b, 0);
    const periodChange = firstHalfTotal > 0
      ? ((secondHalfTotal - firstHalfTotal) / firstHalfTotal) * 100
      : 0;

    return {
      totalSales, totalReplenished, availableStock, trend, dailyAvg, peakDay, activeDays,
      firstHalfTotal, secondHalfTotal, periodChange,
    };
  }, [points, hasRealData, realData, productId]);

  const width = 200;
  const height = 28;

  // For real data with all zeros, show a flat line
  const allZero = points.every(p => p === 0);
  const max = allZero ? 1 : Math.max(...points);
  const min = allZero ? 0 : Math.min(...points);
  const range = max - min || 1;

  const coords = points.map((v, i) => ({
    x: (i / (points.length - 1)) * width,
    y: allZero ? height / 2 : height - 2 - ((v - min) / range) * (height - 4),
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  const isUp = summary.trend >= 0;
  const color = isUp ? "hsl(var(--success))" : "hsl(var(--warning))";

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const pct = relX / rect.width;
    const idx = Math.min(points.length - 1, Math.max(0, Math.round(pct * (points.length - 1))));
    setHoverIndex(idx);
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [points.length]);

  const handleMouseEnter = useCallback((_e: React.MouseEvent<HTMLDivElement>) => {
    if (hoverIndex === null) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const midIdx = Math.floor(points.length / 2);
      setHoverIndex(midIdx);
      setTooltipPos({ x: rect.width / 2, y: 0 });
    }
  }, [hoverIndex, points.length]);

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
  }, []);

  // Determine tooltip edge clamping
  const tooltipAlign = useMemo(() => {
    if (hoverIndex === null) return 'center';
    const pct = hoverIndex / (points.length - 1);
    if (pct < 0.2) return 'left';
    if (pct > 0.8) return 'right';
    return 'center';
  }, [hoverIndex, points.length]);

  const TrendIcon = summary.trend > 2 ? TrendingUp : summary.trend < -2 ? TrendingDown : Minus;

  // Don't render anything if no real data
  if (!hasRealData || points.length < 2) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={cn("w-full relative group/spark", className)}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-7"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`spark-fill-${productId.slice(0, 8)}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={allZero ? "0.05" : "0.3"} />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#spark-fill-${productId.slice(0, 8)})`} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={allZero ? 0.3 : 1}
        />

        {/* Hover crosshair */}
        {hoverIndex !== null && (
          <>
            <line
              x1={coords[hoverIndex].x}
              y1={0}
              x2={coords[hoverIndex].x}
              y2={height}
              stroke={color}
              strokeWidth="0.5"
              strokeDasharray="2 2"
              opacity="0.6"
            />
            <circle
              cx={coords[hoverIndex].x}
              cy={coords[hoverIndex].y}
              r="3.5"
              fill={color}
              stroke="hsl(var(--card))"
              strokeWidth="1.5"
            />
          </>
        )}

        {/* Last point dot */}
        {hoverIndex === null && !allZero && (
          <circle
            cx={coords[coords.length - 1].x}
            cy={coords[coords.length - 1].y}
            r="2"
            fill={color}
          />
        )}
      </svg>

      {/* Tooltip */}
      {hoverIndex !== null && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: tooltipAlign === 'left' ? 0 : tooltipAlign === 'right' ? 'auto' : tooltipPos.x,
            right: tooltipAlign === 'right' ? 0 : 'auto',
            bottom: '100%',
            transform: tooltipAlign === 'center' ? 'translateX(-50%)' : 'none',
            marginBottom: 6,
          }}
        >
          <div className="bg-popover/95 backdrop-blur-md border border-border/60 rounded-xl shadow-2xl shadow-black/20 overflow-hidden min-w-[220px]">
            {/* Header with day info */}
            <div className="px-3 py-2 bg-gradient-to-r from-muted/80 to-transparent border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Activity className="h-3 w-3 text-muted-foreground" />
                   <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                     Mercado · Dia {hoverIndex + 1}
                  </span>
                </div>
                <span className="text-sm font-bold text-foreground">
                  {points[hoverIndex]} un
                </span>
              </div>
              {/* Mini bar showing relative to peak */}
              <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${summary.peakDay > 0 ? (points[hoverIndex] / summary.peakDay) * 100 : 0}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>

            {/* Metrics grid */}
            <div className="px-3 py-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
              <TooltipMetric
                label="Saídas 30d"
                value={`${summary.totalSales.toLocaleString('pt-BR')} un`}
              />
              <TooltipMetric
                label="Disponível"
                value={`${summary.availableStock.toLocaleString('pt-BR')} un`}
              />
              <TooltipMetric
                label="Média/dia"
                value={`${Math.round(summary.dailyAvg)} un`}
              />
              <TooltipMetric
                label="Pico"
                value={`${summary.peakDay} un`}
                highlight
              />
            </div>

            {/* Comparison bar */}
            <div className="px-3 py-2 border-t border-border/40 bg-muted/30">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">1ª metade vs 2ª metade</span>
                <div className="flex items-center gap-1">
                  <TrendIcon className={cn(
                    "h-3 w-3",
                    summary.periodChange > 0 ? "text-success" : summary.periodChange < 0 ? "text-warning" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "font-bold text-[11px]",
                    summary.periodChange > 0 ? "text-success" : summary.periodChange < 0 ? "text-warning" : "text-muted-foreground"
                  )}>
                    {summary.periodChange > 0 ? '+' : ''}{summary.periodChange.toFixed(0)}%
                  </span>
                </div>
              </div>
              {/* Visual comparison bars */}
              <div className="flex gap-1 mt-1.5">
                <div className="flex-1">
                  <div className="h-1.5 rounded-full bg-muted-foreground/15 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-muted-foreground/40"
                      style={{
                        width: `${Math.min(100, summary.firstHalfTotal > 0
                          ? (summary.firstHalfTotal / Math.max(summary.firstHalfTotal, summary.secondHalfTotal)) * 100
                          : 0)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground/70">{summary.firstHalfTotal} un</span>
                </div>
                <div className="flex-1">
                  <div className="h-1.5 rounded-full bg-muted-foreground/15 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, summary.secondHalfTotal > 0
                          ? (summary.secondHalfTotal / Math.max(summary.firstHalfTotal, summary.secondHalfTotal)) * 100
                          : 0)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground/70">{summary.secondHalfTotal} un</span>
                </div>
              </div>
            </div>

            {/* Trend footer */}
            <div className="px-3 py-1.5 border-t border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-warning" />
                <span className="text-[10px] text-muted-foreground">
                  {summary.activeDays}/{points.length} dias ativos
                </span>
              </div>
              <div className={cn(
                "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                summary.trend > 0
                  ? "bg-success/10 text-success"
                  : summary.trend < 0
                  ? "bg-warning/10 text-warning"
                  : "bg-muted text-muted-foreground"
              )}>
                <TrendIcon className="h-3 w-3" />
                {summary.trend > 0 ? '+' : ''}{summary.trend.toFixed(1)}%
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

function TooltipMetric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={cn(
        "text-[11px] font-semibold",
        highlight ? "text-warning" : "text-foreground"
      )}>
        {value}
      </span>
    </div>
  );
}
