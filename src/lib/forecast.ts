/**
 * Forecast & anomaly utilities — regressão linear simples + detecção de outliers (z-score).
 */

export interface ForecastPoint {
  date: string;
  value: number;
  isForecast: boolean;
  lower?: number;
  upper?: number;
}

/**
 * Regressão linear simples (mínimos quadrados) sobre série numérica.
 * Retorna {slope, intercept, residualStd} para projeção.
 */
export function linearRegression(values: number[]): {
  slope: number;
  intercept: number;
  residualStd: number;
} {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0, residualStd: 0 };

  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;

  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  // Desvio padrão dos resíduos (para intervalo de confiança)
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const pred = slope * i + intercept;
    sumSq += (values[i] - pred) ** 2;
  }
  const residualStd = Math.sqrt(sumSq / Math.max(n - 2, 1));

  return { slope, intercept, residualStd };
}

/**
 * Projeta `forecastDays` à frente. Usa intervalo de confiança ~95% (1.96 * residualStd).
 */
export function projectForecast(
  series: Array<{ date: string; value: number }>,
  forecastDays: number,
): ForecastPoint[] {
  if (series.length < 3) {
    return series.map((s) => ({ ...s, isForecast: false }));
  }
  const values = series.map((s) => s.value);
  const { slope, intercept, residualStd } = linearRegression(values);

  const result: ForecastPoint[] = series.map((s) => ({
    date: s.date,
    value: s.value,
    isForecast: false,
  }));

  const lastDate = new Date(series[series.length - 1].date);
  for (let i = 1; i <= forecastDays; i++) {
    const idx = values.length + i - 1;
    const pred = Math.max(0, slope * idx + intercept);
    const ci = 1.96 * residualStd;
    const next = new Date(lastDate);
    next.setDate(next.getDate() + i);
    result.push({
      date: next.toISOString().slice(0, 10),
      value: Math.round(pred),
      isForecast: true,
      lower: Math.max(0, Math.round(pred - ci)),
      upper: Math.round(pred + ci),
    });
  }
  return result;
}

/**
 * Detecta anomalias via z-score. threshold padrão = 2σ.
 */
export function detectAnomalies(values: number[], threshold = 2): boolean[] {
  const n = values.length;
  if (n < 4) return values.map(() => false);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  if (std === 0) return values.map(() => false);
  return values.map((v) => Math.abs((v - mean) / std) >= threshold);
}
